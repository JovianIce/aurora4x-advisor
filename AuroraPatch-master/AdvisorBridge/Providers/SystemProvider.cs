using System;
using System.Collections.Generic;

namespace AdvisorBridge.Providers
{
    /// <summary>
    /// Provides star system, star, system body, and mineral data.
    ///
    /// Save methods:
    ///   im -> FCT_System
    ///   ix -> FCT_Star
    ///   iy -> FCT_JumpPoint
    ///   jn -> FCT_SystemBodyName
    ///   jy -> FCT_AtmosphericGas
    ///   jl -> FCT_MineralDeposit
    ///   i5 -> FCT_LagrangePoint
    ///
    /// NOTE: FCT_SystemBody has NO save method — body data is only available
    /// via MemoryReader or from the on-disk AuroraDB.db file.
    /// </summary>
    public class SystemProvider
    {
        private static readonly string[] SystemTables = { "FCT_System" };
        private static readonly string[] StarTables = { "FCT_Star" };
        private static readonly string[] BodyTables = { "FCT_SystemBodyName", "FCT_AtmosphericGas" };
        private static readonly string[] MineralTables = { "FCT_MineralDeposit" };

        private readonly Lib.DatabaseManager _db;
        private readonly MemoryReader _memory;
        private readonly AuroraPatch.Patch _patch;

        public SystemProvider(Lib.DatabaseManager db, MemoryReader memory, AuroraPatch.Patch patch)
        {
            _db = db;
            _memory = memory;
            _patch = patch;
        }

        // Real-time memory reader
        public List<Dictionary<string, object>> GetSystems() => _memory.ReadSystems();
        public List<Dictionary<string, object>> GetKnownSystems() => _memory.ReadKnownSystems();
        public List<Dictionary<string, object>> GetStars(int? systemId = null) => _memory.ReadStars(systemId);
        public List<Dictionary<string, object>> GetBodies(int? systemId = null) => _memory.ReadBodies(systemId);

        // Domain-scoped SQL (selective refresh)
        public List<Dictionary<string, object>> QuerySystemsSql(string sql)
        {
            var table = _db.QueryTables(sql, SystemTables);
            return QueryHandler.DataTableToList(table);
        }

        public List<Dictionary<string, object>> QueryStarsSql(string sql)
        {
            var table = _db.QueryTables(sql, StarTables);
            return QueryHandler.DataTableToList(table);
        }

        public List<Dictionary<string, object>> QueryBodiesSql(string sql)
        {
            var table = _db.QueryTables(sql, BodyTables);
            return QueryHandler.DataTableToList(table);
        }

        public List<Dictionary<string, object>> QueryMineralsSql(string sql)
        {
            var table = _db.QueryTables(sql, MineralTables);
            return QueryHandler.DataTableToList(table);
        }
    }
}
