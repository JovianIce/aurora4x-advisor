using System.Collections.Generic;

namespace AdvisorBridge
{
    /// <summary>
    /// Action types that can be executed from the frontend.
    /// </summary>
    public enum ActionType
    {
        ClickButton,
        OpenForm,
        ReadControl,
        SetControl,
        InspectForm,
        Composite
    }

    /// <summary>
    /// Request to execute a game action from the frontend.
    /// </summary>
    public class ActionRequest
    {
        public ActionType Action { get; set; }

        /// <summary>
        /// For ClickButton: AuroraButton enum name (e.g. "SubPulse5D", "ToolbarFleet")
        /// For OpenForm/InspectForm: AuroraType enum name (e.g. "EconomicsForm")
        /// For ReadControl/SetControl: ignored (use FormName + ControlName)
        /// </summary>
        public string Target { get; set; }

        /// <summary>
        /// For ReadControl/SetControl: the AuroraType form name to operate on.
        /// </summary>
        public string FormName { get; set; }

        /// <summary>
        /// For ReadControl/SetControl: the WinForms control name (e.g. "cboConstructionType", "txtItems").
        /// </summary>
        public string ControlName { get; set; }

        /// <summary>
        /// For SetControl: the value to set (string for TextBox, bool for CheckBox, string/int for ComboBox).
        /// </summary>
        public object Value { get; set; }

        /// <summary>
        /// For Composite: ordered list of sub-actions to execute atomically.
        /// </summary>
        public List<ActionRequest> Steps { get; set; }
    }

    /// <summary>
    /// Result of an action execution.
    /// </summary>
    public class ActionResult
    {
        public bool Success { get; set; }
        public string Error { get; set; }
        public object Data { get; set; }

        public static ActionResult Ok(object data = null)
        {
            return new ActionResult { Success = true, Data = data };
        }

        public static ActionResult Fail(string error)
        {
            return new ActionResult { Success = false, Error = error };
        }
    }

    /// <summary>
    /// Describes a single control found during form inspection.
    /// </summary>
    public class ControlInfo
    {
        public string Name { get; set; }
        public string Type { get; set; }
        public string Text { get; set; }
        public object Value { get; set; }
        public bool Enabled { get; set; }
        public bool Visible { get; set; }
        public string ParentName { get; set; }
        public List<ControlInfo> Children { get; set; }
    }
}
