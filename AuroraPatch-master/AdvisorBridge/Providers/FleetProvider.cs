using System;
using System.Collections.Generic;

namespace AdvisorBridge.Providers
{
    /// <summary>
    /// Provides fleet and ship data.
    ///
    /// Save methods:
    ///   jh -> FCT_Fleet, FCT_FleetHistory, FCT_FleetStandingOrder, FCT_FleetConditionalOrder
    ///   js -> FCT_Ship, FCT_ShipWeapon, FCT_DamagedComponent, FCT_ShipHistory, ...
    ///   jm -> FCT_ShipClass, FCT_ClassMaterials, FCT_ClassComponent, ...
    ///   jj -> FCT_ShipCargo
    ///   jf -> FCT_SubFleets
    ///   i9 -> FCT_MoveOrders
    ///   ip -> FCT_Squadron
    /// </summary>
    public class FleetProvider
    {
        private static readonly string[] FleetTables = { "FCT_Fleet", "FCT_FleetHistory" };
        private static readonly string[] ShipTables = { "FCT_Ship", "FCT_ShipClass" };
        private static readonly string[] AllTables = {
            "FCT_Fleet", "FCT_Ship", "FCT_ShipClass",
            "FCT_ShipCargo", "FCT_SubFleets", "FCT_MoveOrders", "FCT_Squadron"
        };

        private readonly Lib.DatabaseManager _db;
        private readonly MemoryReader _memory;
        private readonly AuroraPatch.Patch _patch;

        public FleetProvider(Lib.DatabaseManager db, MemoryReader memory, AuroraPatch.Patch patch)
        {
            _db = db;
            _memory = memory;
            _patch = patch;
        }

        // Real-time memory reader
        public List<Dictionary<string, object>> GetFleets() => _memory.ReadFleets();
        public List<Dictionary<string, object>> GetShips(int? fleetId = null) => _memory.ReadShips(fleetId);

        /// <summary>
        /// Run a SQL query after selectively refreshing fleet/ship tables.
        /// </summary>
        public List<Dictionary<string, object>> QuerySql(string sql)
        {
            var table = _db.QueryTables(sql, AllTables);
            return QueryHandler.DataTableToList(table);
        }
    }
}
