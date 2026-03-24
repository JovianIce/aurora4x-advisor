using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace Lib
{
    /// <summary>
    /// Provides WinForms UI interaction helpers for navigating Aurora's control tree.
    ///
    /// Key operations:
    ///   - IterateControls: depth-first traversal of a control's children (non-recursive, stack-based)
    ///   - OpenFormInstance: opens an Aurora form by clicking its toolbar button on the TacticalMap
    ///   - RunOnForm: opens a form and executes an action on it once it's ready (async with 30s timeout)
    ///
    /// All UI-mutating operations are marshalled to the UI thread via InvokeOnUIThread.
    /// </summary>
    public class UIManager
    {
        public static IEnumerable<Control> IterateControls(Control control)
        {
            var stack = new Stack<Control>();
            stack.Push(control);

            while (stack.Count > 0)
            {
                var current = stack.Pop();

                yield return current;

                foreach (Control next in current.Controls)
                {
                    stack.Push(next);
                }
            }
        }

        public static T GetControlByName<T>(Control parent, string name) where T : Control
        {
            return (T)IterateControls(parent).Single(c => c.Name == name);
        }

        private readonly Lib Lib;

        internal UIManager(Lib lib)
        {
            Lib = lib;
        }

        public void RunOnForm(AuroraType type, Action<Form> action)
        {
            if (!OpenFormInstance(type))
            {
                Lib.LogError($"UIManager could not open form {type}");

                return;
            }

            try
            {
                var formtype = Lib.SignatureManager.Get(type);
                var form = Lib.GetOpenForms().FirstOrDefault(f => f.GetType().Name == formtype.Name);

                var t = new Task(() =>
                {
                    try
                    {
                        var end = DateTime.UtcNow + TimeSpan.FromSeconds(30);
                        while (form == null)
                        {
                            Lib.LogDebug($"Waiting for form");
                            Thread.Sleep(100);
                            form = Lib.GetOpenForms().FirstOrDefault(f => f.GetType().Name == formtype.Name);

                            if (DateTime.UtcNow > end)
                            {
                                break;
                            }
                        }

                        if (form == null)
                        {
                            Lib.LogError($"Could not find open form {type}");

                            return;
                        }

                        Lib.InvokeOnUIThread(new Action(() =>
                        {
                            form.Activate();
                            action(form);
                        }));
                    }
                    catch (Exception e)
                    {
                        Lib.LogError($"Failed to wait for form {type}. {e}");
                    }
                });

                t.Start();
            }
            catch (Exception e)
            {
                Lib.LogError($"Failed to run on form {type}. {e}");
            }

        }

        public bool OpenFormInstance(AuroraType type)
        {
            try
            {
                var formtype = Lib.SignatureManager.Get(type);
                if (formtype == null)
                {
                    return false;
                }

                foreach (var open in Lib.GetOpenForms())
                {
                    if (open.GetType().Name == formtype.Name)
                    {
                        return true;
                    }
                }

                if (Lib.TacticalMap == null)
                {
                    return false;
                }

                var name = Lib.KnowledgeBase.GetFormOpenButtonName(type);
                if (name == null)
                {
                    return false;
                }

                var action = new Action(() =>
                {
                    var button = GetControlByName<Button>(Lib.TacticalMap, name);
                    Lib.TacticalMap.Activate();
                    button.PerformClick();
                });
                Lib.InvokeOnUIThread(action);

                return true;
            }
            catch (Exception e)
            {
                Lib.LogError($"UIManager failed to open form {type}. {e}");

                return false;
            }
        }
    }
}
