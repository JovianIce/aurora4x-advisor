using System;
using System.Collections.Generic;
using System.Data;
using Newtonsoft.Json;

namespace AdvisorBridge
{
    /// <summary>
    /// Handles SQL query safety and result conversion for the WebSocket bridge.
    /// Only allows SELECT and PRAGMA queries to prevent game state corruption.
    /// PRAGMA is permitted for schema inspection (e.g. PRAGMA table_info).
    /// </summary>
    public static class QueryHandler
    {
        public static List<Dictionary<string, object>> DataTableToList(DataTable table)
        {
            var rows = new List<Dictionary<string, object>>();
            if (table == null) return rows;

            foreach (DataRow row in table.Rows)
            {
                var dict = new Dictionary<string, object>();
                foreach (DataColumn col in table.Columns)
                {
                    var value = row[col];
                    dict[col.ColumnName] = value is DBNull ? null : value;
                }
                rows.Add(dict);
            }

            return rows;
        }

        public static bool IsSafeQuery(string sql)
        {
            if (string.IsNullOrWhiteSpace(sql)) return false;

            var trimmed = sql.TrimStart().ToUpperInvariant();

            // Only allow SELECT and PRAGMA (for schema inspection)
            if (trimmed.StartsWith("SELECT") || trimmed.StartsWith("PRAGMA"))
            {
                return true;
            }

            return false;
        }
    }
}
