using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Windows.Forms;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace AdvisorBridge
{
    /// <summary>
    /// Executes game actions on Aurora's UI thread, invoked from the Electron frontend.
    /// Thread-safe: one action at a time via lock, with 5-second timeout guard.
    /// </summary>
    public class ActionExecutor
    {
        private readonly Lib.Lib _lib;
        private readonly AuroraPatch.Patch _patch;
        private readonly object _executionLock = new object();
        private static readonly TimeSpan ActionTimeout = TimeSpan.FromSeconds(5);

        public ActionExecutor(Lib.Lib lib, AuroraPatch.Patch patch)
        {
            _lib = lib;
            _patch = patch;
        }

        /// <summary>
        /// Execute an action request. Thread-safe — only one action runs at a time.
        /// </summary>
        public ActionResult Execute(ActionRequest request)
        {
            if (request == null)
                return ActionResult.Fail("Null action request");

            lock (_executionLock)
            {
                try
                {
                    switch (request.Action)
                    {
                        case ActionType.ClickButton:
                            return ExecuteClickButton(request);
                        case ActionType.OpenForm:
                            return ExecuteOpenForm(request);
                        case ActionType.ReadControl:
                            return ExecuteReadControl(request);
                        case ActionType.SetControl:
                            return ExecuteSetControl(request);
                        case ActionType.InspectForm:
                            return ExecuteInspectForm(request);
                        case ActionType.Composite:
                            return ExecuteComposite(request);
                        default:
                            return ActionResult.Fail($"Unknown action type: {request.Action}");
                    }
                }
                catch (Exception ex)
                {
                    _patch.LogError($"ActionExecutor error: {ex}");
                    return ActionResult.Fail($"Action failed: {ex.Message}");
                }
            }
        }

        private ActionResult ExecuteClickButton(ActionRequest request)
        {
            if (string.IsNullOrEmpty(request.Target))
                return ActionResult.Fail("ClickButton requires Target (AuroraButton enum name)");

            Lib.AuroraButton buttonEnum;
            if (!Enum.TryParse(request.Target, true, out buttonEnum))
                return ActionResult.Fail($"Unknown button: {request.Target}. Valid values: {string.Join(", ", Enum.GetNames(typeof(Lib.AuroraButton)))}");

            var buttonName = _lib.KnowledgeBase.GetButtonName(buttonEnum);
            if (buttonName == null)
                return ActionResult.Fail($"No WinForms control name mapped for button: {request.Target}");

            var map = _patch.TacticalMap;
            if (map == null)
                return ActionResult.Fail("TacticalMap not available");

            // Use BeginInvoke (async, non-blocking) so clicks can interrupt auto-run
            map.BeginInvoke(new Action(() =>
            {
                try
                {
                    var button = Lib.UIManager.GetControlByName<Button>(map, buttonName);
                    button.PerformClick();
                }
                catch (Exception ex)
                {
                    _patch.LogError($"ClickButton async error: {ex.Message}");
                }
            }));

            _patch.LogInfo($"Clicked button: {request.Target} ({buttonName})");
            return ActionResult.Ok(new { button = request.Target, controlName = buttonName });
        }

        private ActionResult ExecuteOpenForm(ActionRequest request)
        {
            if (string.IsNullOrEmpty(request.Target))
                return ActionResult.Fail("OpenForm requires Target (AuroraType enum name)");

            Lib.AuroraType formEnum;
            if (!Enum.TryParse(request.Target, true, out formEnum))
                return ActionResult.Fail($"Unknown form: {request.Target}. Valid values: {string.Join(", ", Enum.GetNames(typeof(Lib.AuroraType)))}");

            var opened = _lib.UIManager.OpenFormInstance(formEnum);
            if (!opened)
                return ActionResult.Fail($"Failed to open form: {request.Target}");

            _patch.LogInfo($"Opened form: {request.Target}");
            return ActionResult.Ok(new { form = request.Target });
        }

        private ActionResult ExecuteReadControl(ActionRequest request)
        {
            if (string.IsNullOrEmpty(request.FormName))
                return ActionResult.Fail("ReadControl requires FormName");
            if (string.IsNullOrEmpty(request.ControlName))
                return ActionResult.Fail("ReadControl requires ControlName");

            var form = FindOpenForm(request.FormName);
            if (form == null)
                return ActionResult.Fail($"Form not open: {request.FormName}. Open it first with OpenForm.");

            object controlValue = null;
            string controlType = null;

            var result = InvokeWithTimeout(() =>
            {
                var control = FindControlByName(form, request.ControlName);
                if (control == null)
                    throw new Exception($"Control not found: {request.ControlName}");

                controlType = control.GetType().Name;
                controlValue = ReadControlValue(control);
            });

            if (!result)
                return ActionResult.Fail("ReadControl timed out");

            return ActionResult.Ok(new { controlName = request.ControlName, type = controlType, value = controlValue });
        }

        private ActionResult ExecuteSetControl(ActionRequest request)
        {
            if (string.IsNullOrEmpty(request.FormName))
                return ActionResult.Fail("SetControl requires FormName");
            if (string.IsNullOrEmpty(request.ControlName))
                return ActionResult.Fail("SetControl requires ControlName");

            var form = FindOpenForm(request.FormName);
            if (form == null)
                return ActionResult.Fail($"Form not open: {request.FormName}. Open it first with OpenForm.");

            string controlType = null;

            var result = InvokeWithTimeout(() =>
            {
                var control = FindControlByName(form, request.ControlName);
                if (control == null)
                    throw new Exception($"Control not found: {request.ControlName}");

                controlType = control.GetType().Name;
                SetControlValue(control, request.Value);
            });

            if (!result)
                return ActionResult.Fail("SetControl timed out");

            return ActionResult.Ok(new { controlName = request.ControlName, type = controlType, valueSet = true });
        }

        private ActionResult ExecuteInspectForm(ActionRequest request)
        {
            if (string.IsNullOrEmpty(request.Target))
                return ActionResult.Fail("InspectForm requires Target (AuroraType enum name)");

            Lib.AuroraType formEnum;
            if (!Enum.TryParse(request.Target, true, out formEnum))
                return ActionResult.Fail($"Unknown form: {request.Target}");

            // Open the form first if not already open
            _lib.UIManager.OpenFormInstance(formEnum);

            // Wait briefly for form to appear
            Form form = null;
            var formType = _lib.SignatureManager.Get(formEnum);
            if (formType == null)
                return ActionResult.Fail($"Cannot resolve type for form: {request.Target}");

            var deadline = DateTime.UtcNow + TimeSpan.FromSeconds(5);
            while (form == null && DateTime.UtcNow < deadline)
            {
                form = _lib.GetOpenForms().FirstOrDefault(f => f.GetType().Name == formType.Name);
                if (form == null)
                    Thread.Sleep(100);
            }

            if (form == null)
                return ActionResult.Fail($"Form did not open within timeout: {request.Target}");

            List<ControlInfo> controls = null;

            var result = InvokeWithTimeout(() =>
            {
                controls = InspectControls(form);
            });

            if (!result)
                return ActionResult.Fail("InspectForm timed out");

            _patch.LogInfo($"Inspected form: {request.Target} ({controls?.Count ?? 0} top-level controls)");
            return ActionResult.Ok(new { form = request.Target, controls });
        }

        private ActionResult ExecuteComposite(ActionRequest request)
        {
            if (request.Steps == null || request.Steps.Count == 0)
                return ActionResult.Fail("Composite requires Steps (non-empty list of actions)");

            var results = new List<object>();

            for (int i = 0; i < request.Steps.Count; i++)
            {
                var step = request.Steps[i];
                // Execute within the same lock (we're already holding it)
                ActionResult stepResult;
                try
                {
                    switch (step.Action)
                    {
                        case ActionType.ClickButton:
                            stepResult = ExecuteClickButton(step);
                            break;
                        case ActionType.OpenForm:
                            stepResult = ExecuteOpenForm(step);
                            break;
                        case ActionType.ReadControl:
                            stepResult = ExecuteReadControl(step);
                            break;
                        case ActionType.SetControl:
                            stepResult = ExecuteSetControl(step);
                            break;
                        case ActionType.InspectForm:
                            stepResult = ExecuteInspectForm(step);
                            break;
                        default:
                            stepResult = ActionResult.Fail($"Unknown action in step {i}: {step.Action}");
                            break;
                    }
                }
                catch (Exception ex)
                {
                    stepResult = ActionResult.Fail($"Step {i} failed: {ex.Message}");
                }

                results.Add(new { step = i, action = step.Action.ToString(), result = stepResult });

                if (!stepResult.Success)
                {
                    return ActionResult.Fail($"Composite failed at step {i}: {stepResult.Error}");
                }
            }

            return ActionResult.Ok(new { steps = results.Count, results });
        }

        // --- Helpers ---

        /// <summary>
        /// Invoke an action on the UI thread with a timeout guard.
        /// Returns true if completed within timeout, false if timed out.
        /// </summary>
        private bool InvokeWithTimeout(Action action)
        {
            Exception caughtEx = null;
            var done = new ManualResetEventSlim(false);

            _patch.InvokeOnUIThread(new Action(() =>
            {
                try
                {
                    action();
                }
                catch (Exception ex)
                {
                    caughtEx = ex;
                }
                finally
                {
                    done.Set();
                }
            }));

            var completed = done.Wait(ActionTimeout);

            if (caughtEx != null)
                throw caughtEx;

            return completed;
        }

        /// <summary>
        /// Find an open form by AuroraType enum name.
        /// </summary>
        private Form FindOpenForm(string formEnumName)
        {
            Lib.AuroraType formEnum;
            if (!Enum.TryParse(formEnumName, true, out formEnum))
                return null;

            var formType = _lib.SignatureManager.Get(formEnum);
            if (formType == null)
                return null;

            return _lib.GetOpenForms().FirstOrDefault(f => f.GetType().Name == formType.Name);
        }

        /// <summary>
        /// Find a control by name within a form, returning null if not found.
        /// </summary>
        private Control FindControlByName(Control parent, string name)
        {
            return Lib.UIManager.IterateControls(parent).FirstOrDefault(c => c.Name == name);
        }

        /// <summary>
        /// Read a control's current value based on its type.
        /// </summary>
        private object ReadControlValue(Control control)
        {
            if (control is TextBox textBox)
                return textBox.Text;

            if (control is ComboBox comboBox)
                return new
                {
                    selectedIndex = comboBox.SelectedIndex,
                    selectedItem = comboBox.SelectedItem?.ToString(),
                    items = comboBox.Items.Cast<object>().Select(i => i.ToString()).ToList()
                };

            if (control is CheckBox checkBox)
                return checkBox.Checked;

            if (control is RadioButton radioButton)
                return radioButton.Checked;

            if (control is NumericUpDown numeric)
                return numeric.Value;

            if (control is ListBox listBox)
                return new
                {
                    selectedIndex = listBox.SelectedIndex,
                    selectedItem = listBox.SelectedItem?.ToString(),
                    items = listBox.Items.Cast<object>().Select(i => i.ToString()).ToList()
                };

            if (control is Label label)
                return label.Text;

            if (control is TabControl tabControl)
                return new
                {
                    selectedIndex = tabControl.SelectedIndex,
                    selectedTab = tabControl.SelectedTab?.Name,
                    tabs = tabControl.TabPages.Cast<TabPage>().Select(t => new { t.Name, t.Text }).ToList()
                };

            if (control is TreeView treeView)
                return new
                {
                    nodeCount = treeView.Nodes.Count,
                    selectedNode = treeView.SelectedNode?.Text
                };

            if (control is DataGridView dgv)
                return new
                {
                    rowCount = dgv.RowCount,
                    columnCount = dgv.ColumnCount
                };

            // Fallback
            return control.Text;
        }

        /// <summary>
        /// Set a control's value based on its type.
        /// </summary>
        private void SetControlValue(Control control, object value)
        {
            if (control is TextBox textBox)
            {
                textBox.Text = value?.ToString() ?? "";
                return;
            }

            if (control is ComboBox comboBox)
            {
                // Accept index (int) or text (string) for selection
                if (value is long || value is int)
                {
                    comboBox.SelectedIndex = Convert.ToInt32(value);
                }
                else
                {
                    var text = value?.ToString();
                    for (int i = 0; i < comboBox.Items.Count; i++)
                    {
                        if (comboBox.Items[i].ToString() == text)
                        {
                            comboBox.SelectedIndex = i;
                            return;
                        }
                    }
                    throw new Exception($"ComboBox item not found: {text}");
                }
                return;
            }

            if (control is CheckBox checkBox)
            {
                checkBox.Checked = Convert.ToBoolean(value);
                return;
            }

            if (control is RadioButton radioButton)
            {
                radioButton.Checked = Convert.ToBoolean(value);
                return;
            }

            if (control is NumericUpDown numeric)
            {
                numeric.Value = Convert.ToDecimal(value);
                return;
            }

            if (control is ListBox listBox)
            {
                if (value is long || value is int)
                {
                    listBox.SelectedIndex = Convert.ToInt32(value);
                }
                else
                {
                    var text = value?.ToString();
                    for (int i = 0; i < listBox.Items.Count; i++)
                    {
                        if (listBox.Items[i].ToString() == text)
                        {
                            listBox.SelectedIndex = i;
                            return;
                        }
                    }
                    throw new Exception($"ListBox item not found: {text}");
                }
                return;
            }

            if (control is TabControl tabControl)
            {
                if (value is long || value is int)
                {
                    tabControl.SelectedIndex = Convert.ToInt32(value);
                }
                else
                {
                    var tabName = value?.ToString();
                    for (int i = 0; i < tabControl.TabPages.Count; i++)
                    {
                        if (tabControl.TabPages[i].Name == tabName || tabControl.TabPages[i].Text == tabName)
                        {
                            tabControl.SelectedIndex = i;
                            return;
                        }
                    }
                    throw new Exception($"Tab not found: {tabName}");
                }
                return;
            }

            // Fallback: try setting Text
            control.Text = value?.ToString() ?? "";
        }

        /// <summary>
        /// Build a tree of ControlInfo for form inspection.
        /// </summary>
        private List<ControlInfo> InspectControls(Control parent)
        {
            var result = new List<ControlInfo>();

            foreach (Control child in parent.Controls)
            {
                var info = new ControlInfo
                {
                    Name = child.Name,
                    Type = child.GetType().Name,
                    Text = TruncateText(child.Text, 200),
                    Enabled = child.Enabled,
                    Visible = child.Visible,
                    ParentName = parent.Name
                };

                // Read value for interactive controls
                try
                {
                    if (child is TextBox || child is ComboBox || child is CheckBox ||
                        child is RadioButton || child is NumericUpDown || child is ListBox ||
                        child is TabControl)
                    {
                        info.Value = ReadControlValue(child);
                    }
                }
                catch { }

                // Recurse into children
                if (child.Controls.Count > 0)
                {
                    info.Children = InspectControls(child);
                }

                result.Add(info);
            }

            return result;
        }

        private string TruncateText(string text, int maxLength)
        {
            if (string.IsNullOrEmpty(text)) return text;
            return text.Length <= maxLength ? text : text.Substring(0, maxLength) + "...";
        }
    }
}
