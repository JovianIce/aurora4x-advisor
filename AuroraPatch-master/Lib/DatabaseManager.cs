using HarmonyLib;
using System;
using System.Collections.Generic;
using System.Data;
using System.Data.SQLite;
using System.Diagnostics;
using System.Linq;
using System.Reflection;
using System.Text.RegularExpressions;

namespace Lib
{
    /// <summary>
    /// Maintains an in-memory SQLite database that mirrors Aurora's game state.
    ///
    /// Two refresh modes:
    ///   - Full: calls all save methods
    ///   - Selective: calls only the methods that write to specific tables
    ///
    /// The table-to-method mapping is hardcoded from trigger-based discovery.
    /// Re-discovery is available via RediscoverMapping() for verification or
    /// if Aurora updates change the obfuscated method names.
    /// </summary>
    public class DatabaseManager
    {
        private readonly Lib Lib;
        private SQLiteConnection Connection { get; set; } = null;
        private bool _needsRefresh = true;

        // Selective save: resolved from hardcoded mapping on first use
        private Dictionary<string, List<MethodInfo>> _tableToMethods;
        private Dictionary<string, List<string>> _methodToTables;
        private bool _mappingReady;

        // Freshness tracking
        private readonly HashSet<string> _freshTables = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        // =====================================================================
        // Hardcoded mapping: obfuscated method name -> tables it writes to.
        // Keyed by Aurora.exe checksum since method names change between versions.
        // Discovered via trigger-based analysis (INSERT/UPDATE/DELETE tracking).
        //
        // For unknown checksums, the system falls back to automatic trigger-based
        // discovery (slower first query, but works for any version).
        //
        // To add a new version: run rediscoverMapping on the new build and add
        // the output here. See SAVE_METHOD_MAPPING.md for details.
        // =====================================================================
        private static readonly Dictionary<string, Dictionary<string, string[]>> VersionedMappings =
            new Dictionary<string, Dictionary<string, string[]>>
        {
            // Aurora checksum OdxONo (current development target)
            { "OdxONo", new Dictionary<string, string[]>
                {
                    // Research
                    { "kc", new[] { "FCT_ResearchProject" } },
                    { "kk", new[] { "FCT_RaceTech" } },
                    { "km", new[] { "FCT_TechSystem" } },
                    { "i2", new[] { "FCT_TechProgressionRace" } },
                    { "k0", new[] { "FCT_DesignPhilosophy", "FCT_DesignPhilosophyTechProgressionCategories" } },

                    // Fleets & Orders
                    { "jh", new[] { "FCT_Fleet", "FCT_FleetHistory", "FCT_FleetStandingOrder", "FCT_FleetConditionalOrder" } },
                    { "jf", new[] { "FCT_SubFleets" } },
                    { "i9", new[] { "FCT_MoveOrders" } },
                    { "ja", new[] { "FCT_MoveOrderTemplate" } },
                    { "jg", new[] { "FCT_StandingOrderTemplate", "FCT_StandingOrderTemplateOrder" } },
                    { "iz", new[] { "FCT_OrderTemplate" } },
                    { "ip", new[] { "FCT_Squadron" } },

                    // Ships & Classes
                    { "js", new[] { "FCT_Ship", "FCT_ShipWeapon", "FCT_DamagedComponent", "FCT_ShipHistory",
                                    "FCT_WeaponAssignment", "FCT_DecoyAssignment", "FCT_FireControlAssignment",
                                    "FCT_MissileAssignment", "FCT_ArmourDamage", "FCT_ShipMeasurement" } },
                    { "jj", new[] { "FCT_ShipCargo" } },
                    { "jz", new[] { "FCT_DamageControlQueue" } },
                    { "jm", new[] { "FCT_ShipClass", "FCT_ClassMaterials", "FCT_ClassOrdnanceTemplate",
                                    "FCT_ClassComponent", "FCT_ClassSC", "FCT_ClassGroundTemplates" } },
                    { "kn", new[] { "FCT_ShipDesignComponents" } },
                    { "kp", new[] { "FCT_ShipComponentTemplate" } },
                    { "jx", new[] { "FCT_MissileType" } },
                    { "j0", new[] { "FCT_HullDescription" } },

                    // Systems & Stars
                    { "im", new[] { "FCT_System" } },
                    { "ix", new[] { "FCT_Star" } },
                    { "iy", new[] { "FCT_JumpPoint" } },
                    { "i5", new[] { "FCT_LagrangePoint" } },
                    { "jn", new[] { "FCT_SystemBodyName" } },
                    { "jy", new[] { "FCT_AtmosphericGas" } },

                    // Minerals & Economy
                    { "jl", new[] { "FCT_MineralDeposit" } },
                    { "j5", new[] { "FCT_WealthData" } },
                    { "j6", new[] { "FCT_RaceMineralData" } },
                    { "i6", new[] { "FCT_PopTradeBalance" } },
                    { "i4", new[] { "FCT_MassDriverPackets" } },

                    // Population & Industry
                    { "jk", new[] { "FCT_Population", "FCT_PopulationWeapon", "FCT_PopComponent", "FCT_PopMDChanges" } },
                    { "ji", new[] { "FCT_PopulationInstallations" } },
                    { "jv", new[] { "FCT_IndustrialProjects" } },
                    { "j2", new[] { "FCT_Shipyard" } },

                    // Commanders
                    { "j1", new[] { "FCT_Commander", "FCT_CommanderHistory", "FCT_CommanderMedal",
                                    "FCT_CommanderMeasurement", "FCT_CommanderBonuses", "FCT_CommanderTraits" } },

                    // Race & Game
                    { "a5", new[] { "FCT_Game" } },
                    { "a6", new[] { "FCT_Race", "FCT_KnownRuinRace", "FCT_RaceNameThemes", "FCT_WindowPosition",
                                    "FCT_GroundUnitSeries", "FCT_GroundUnitSeriesClass",
                                    "FCT_RaceOperationalGroupElements", "FCT_HullNumber", "FCT_WealthHistory" } },
                    { "j4", new[] { "FCT_Species", "FCT_KnownSpecies" } },

                    // Surveys
                    { "kz", new[] { "FCT_RaceSysSurvey", "FCT_RaceJumpPointSurvey" } },
                    { "iw", new[] { "FCT_SurveyLocation", "FCT_RaceSurveyLocation" } },

                    // Ground Units
                    { "ir", new[] { "FCT_GroundUnitFormationElement", "FCT_GroundUnitFormationElementTemplates", "FCT_STODetected" } },
                    { "is", new[] { "FCT_GroundUnitFormationTemplate" } },
                    { "it", new[] { "FCT_GroundUnitFormation" } },
                    { "iu", new[] { "FCT_GroundUnitClass", "FCT_GroundUnitCapability" } },

                    // Aliens
                    { "ke", new[] { "FCT_AlienRace", "FCT_AlienRaceSpecies", "FCT_AlienSystem" } },
                    { "kf", new[] { "FCT_AlienClass", "FCT_AlienClassSensor", "FCT_AlienClassWeapon", "FCT_AlienClassTech" } },
                    { "kg", new[] { "FCT_AlienRaceSensor" } },
                    { "kh", new[] { "FCT_AlienShip" } },
                    { "ki", new[] { "FCT_AlienGroundUnitClass" } },
                    { "kj", new[] { "FCT_AlienPopulation" } },

                    // Misc
                    { "kd", new[] { "FCT_SectorCommand" } },
                    { "ko", new[] { "FCT_Increments" } },
                    { "ks", new[] { "FCT_GameLog" } },
                    { "kt", new[] { "FCT_EventColour" } },
                    { "kw", new[] { "FCT_OrganizationNode" } },
                    { "kx", new[] { "FCT_Ranks" } },
                    { "ky", new[] { "FCT_HideEvents" } },
                    { "iq", new[] { "FCT_WindowPosition" } },
                    { "in", new[] { "FCT_RaceMedals" } },
                    { "io", new[] { "FCT_MedalConditionAssignment" } },
                    { "jp", new[] { "FCT_AncientConstruct" } },
                    { "jr", new[] { "FCT_RuinRace" } },
                    { "ju", new[] { "FCT_Wrecks", "FCT_WreckTech", "FCT_WreckComponents" } },
                    { "j8", new[] { "FCT_NavalAdminCommand" } },
                }
            },

            // Aurora checksum chm1c7 — no mapping yet.
            // Run rediscoverMapping on this version to populate.
        };

        internal DatabaseManager(Lib lib)
        {
            Lib = lib;
        }

        public void Refresh()
        {
            _needsRefresh = true;
        }

        public void MarkAllStale()
        {
            _freshTables.Clear();
        }

        public bool HasMapping => _mappingReady;

        public Dictionary<string, List<string>> GetMethodTableMapping()
        {
            return _methodToTables;
        }

        /// <summary>
        /// Force re-discovery of the table mapping using SQLite triggers.
        /// Useful to verify the hardcoded mapping or after an Aurora update.
        /// </summary>
        public void RediscoverMapping()
        {
            _mappingReady = false;
            _tableToMethods = null;
            _methodToTables = null;
            _needsRefresh = true;
            _forceDiscovery = true;
        }

        private bool _forceDiscovery;

        /// <summary>
        /// Smart query: extracts FCT_* table names from the SQL, selectively
        /// refreshes only those tables, then executes the query.
        /// Handles joins, subqueries, etc. automatically.
        /// </summary>
        public DataTable SmartQuery(string sql)
        {
            EnsureDatabase();
            EnsureMapping();

            var tables = ExtractTableNames(sql);

            lock (Connection)
            {
                if (tables.Length > 0)
                    RefreshForTables(tables);

                return RunQuery(sql);
            }
        }

        /// <summary>
        /// Full refresh query — calls all save methods. Use for PRAGMA, sqlite_master,
        /// or when you need everything fresh regardless of cost.
        /// </summary>
        public DataTable ExecuteQuery(string query)
        {
            EnsureDatabase();
            EnsureMapping();

            lock (Connection)
            {
                if (_needsRefresh)
                {
                    try
                    {
                        var sw = Stopwatch.StartNew();
                        Lib.InvokeOnUIThread(new Action(() => SaveAll()));
                        _needsRefresh = false;
                        _freshTables.Clear();
                        sw.Stop();
                        Lib.LogInfo($"Full save took {sw.ElapsedMilliseconds} ms");
                    }
                    catch (Exception e)
                    {
                        Lib.LogError($"DatabaseManager failed to save. {e}");
                    }
                }

                return RunQuery(query);
            }
        }

        /// <summary>
        /// Query with explicit table list for selective refresh.
        /// </summary>
        public DataTable QueryTables(string sql, params string[] tables)
        {
            EnsureDatabase();
            EnsureMapping();

            lock (Connection)
            {
                RefreshForTables(tables);
                return RunQuery(sql);
            }
        }

        /// <summary>
        /// Extract FCT_* table names from a SQL string.
        /// Works for SELECT, JOIN, subqueries — any mention of an Aurora table.
        /// </summary>
        public static string[] ExtractTableNames(string sql)
        {
            var tables = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (Match m in Regex.Matches(sql, @"""?(FCT_\w+)""?", RegexOptions.IgnoreCase))
            {
                tables.Add(m.Groups[1].Value);
            }
            return tables.ToArray();
        }

        private void EnsureMapping()
        {
            if (_mappingReady) return;

            if (_forceDiscovery)
            {
                try
                {
                    Lib.InvokeOnUIThread(new Action(() => DiscoverMapping()));
                    _forceDiscovery = false;
                }
                catch (Exception e)
                {
                    Lib.LogError($"Discovery failed, falling back to hardcoded. {e}");
                    Dictionary<string, string[]> fallback;
                    if (Lib.AuroraChecksum != null && VersionedMappings.TryGetValue(Lib.AuroraChecksum, out fallback))
                        ResolveHardcodedMapping(fallback);
                    else
                        Lib.LogError("No hardcoded fallback available either.");
                }
                return;
            }

            // Check if we have a hardcoded mapping for this Aurora version
            var checksum = Lib.AuroraChecksum;
            Dictionary<string, string[]> versionMapping;
            if (checksum != null && VersionedMappings.TryGetValue(checksum, out versionMapping))
            {
                Lib.LogInfo($"Using hardcoded save mapping for Aurora checksum {checksum}");
                ResolveHardcodedMapping(versionMapping);
            }
            else
            {
                // Unknown version — auto-discover via triggers
                Lib.LogInfo($"No hardcoded mapping for Aurora checksum '{checksum}' — running auto-discovery");
                try
                {
                    Lib.InvokeOnUIThread(new Action(() => DiscoverMapping()));
                    return; // DiscoverMapping does its own full save
                }
                catch (Exception e)
                {
                    Lib.LogError($"Auto-discovery failed for unknown version. {e}");
                }
            }

            // First time with hardcoded mapping: do a full save to populate the DB
            try
            {
                var sw = Stopwatch.StartNew();
                Lib.InvokeOnUIThread(new Action(() => SaveAll()));
                _needsRefresh = false;
                _freshTables.Clear();
                sw.Stop();
                Lib.LogInfo($"Initial full save took {sw.ElapsedMilliseconds} ms");
            }
            catch (Exception e)
            {
                Lib.LogError($"Initial save failed. {e}");
            }
        }

        // =====================================================================
        // Hardcoded mapping resolution
        // =====================================================================

        private void ResolveHardcodedMapping(Dictionary<string, string[]> mapping)
        {
            var methods = Lib.KnowledgeBase.GetSaveMethods();
            var methodByName = new Dictionary<string, MethodInfo>();
            foreach (var m in methods)
                methodByName[m.Name] = m;

            _methodToTables = new Dictionary<string, List<string>>();
            _tableToMethods = new Dictionary<string, List<MethodInfo>>(StringComparer.OrdinalIgnoreCase);

            int resolved = 0;
            foreach (var kvp in mapping)
            {
                MethodInfo mi;
                if (!methodByName.TryGetValue(kvp.Key, out mi))
                {
                    Lib.LogError($"Hardcoded method '{kvp.Key}' not found in save methods — checksum mismatch?");
                    continue;
                }

                _methodToTables[kvp.Key] = new List<string>(kvp.Value);
                resolved++;

                foreach (var table in kvp.Value)
                {
                    if (!_tableToMethods.ContainsKey(table))
                        _tableToMethods[table] = new List<MethodInfo>();
                    _tableToMethods[table].Add(mi);
                }
            }

            // Include methods with no known tables
            foreach (var m in methods)
            {
                if (!_methodToTables.ContainsKey(m.Name))
                    _methodToTables[m.Name] = new List<string>();
            }

            _mappingReady = true;
            Lib.LogInfo($"Hardcoded mapping resolved: {resolved}/{mapping.Count} methods matched, {_tableToMethods.Count} tables");
        }

        // =====================================================================
        // Selective refresh
        // =====================================================================

        private void RefreshForTables(string[] tables)
        {
            var staleTables = tables.Where(t => !_freshTables.Contains(t)).ToArray();
            if (staleTables.Length == 0) return;

            var methodsNeeded = new HashSet<MethodInfo>();
            foreach (var table in staleTables)
            {
                List<MethodInfo> methods;
                if (_tableToMethods.TryGetValue(table, out methods))
                    foreach (var m in methods)
                        methodsNeeded.Add(m);
            }

            if (methodsNeeded.Count == 0)
            {
                foreach (var t in staleTables)
                    _freshTables.Add(t);
                return;
            }

            try
            {
                var sw = Stopwatch.StartNew();
                var methodList = methodsNeeded.ToList();

                Lib.InvokeOnUIThread(new Action(() => SaveMethods(methodList)));

                foreach (var t in staleTables)
                    _freshTables.Add(t);

                sw.Stop();
                Lib.LogInfo($"Selective save: {methodList.Count} methods for [{string.Join(", ", staleTables)}] took {sw.ElapsedMilliseconds} ms");
            }
            catch (Exception e)
            {
                Lib.LogError($"DatabaseManager selective save failed. {e}");
            }
        }

        // =====================================================================
        // Trigger-based discovery (diagnostic / re-discovery)
        // =====================================================================

        private void DiscoverMapping()
        {
            var map = Lib.TacticalMap;
            if (map == null) return;

            var game = Lib.KnowledgeBase.GetGameState(map);
            if (game == null) return;

            var methods = Lib.KnowledgeBase.GetSaveMethods();
            if (methods.Count == 0) return;

            // Full save first so UPDATEs have data to hit
            Lib.LogInfo("Mapping discovery: populating DB with full save...");
            var swFull = Stopwatch.StartNew();
            SaveMethods(methods, game);
            swFull.Stop();
            Lib.LogInfo($"Mapping discovery: full save took {swFull.ElapsedMilliseconds} ms");

            var allTables = GetManagedTableNames();
            allTables.RemoveAll(t => t.StartsWith("_mapping_"));
            Lib.LogInfo($"Mapping discovery: {allTables.Count} tables, {methods.Count} save methods");

            var methodToTables = new Dictionary<string, List<string>>();
            var tableToMethods = new Dictionary<string, List<MethodInfo>>(StringComparer.OrdinalIgnoreCase);

            SetupTrackingTriggers(allTables);

            try
            {
                object reflectionConn = OpenReflectionConnection(methods[0]);

                foreach (var method in methods)
                {
                    ClearTracking();
                    method.Invoke(game, new object[] { reflectionConn });
                    var touched = GetTrackedTables();

                    methodToTables[method.Name] = touched;

                    foreach (var table in touched)
                    {
                        if (!tableToMethods.ContainsKey(table))
                            tableToMethods[table] = new List<MethodInfo>();
                        tableToMethods[table].Add(method);
                    }

                    if (touched.Count > 0)
                        Lib.LogInfo($"SaveMethod {method.Name} -> [{string.Join(", ", touched)}]");
                }

                reflectionConn.GetType().GetMethod("Close").Invoke(reflectionConn, new object[0]);
            }
            finally
            {
                CleanupTracking(allTables);
            }

            _methodToTables = methodToTables;
            _tableToMethods = tableToMethods;
            _mappingReady = true;

            var tablesWithMethods = tableToMethods.Count;
            var methodsWithTables = methodToTables.Count(kvp => kvp.Value.Count > 0);
            Lib.LogInfo($"Mapping discovered: {methodsWithTables}/{methodToTables.Count} methods write to {tablesWithMethods} tables");
        }

        private void SetupTrackingTriggers(List<string> tables)
        {
            using (var cmd = Connection.CreateCommand())
            {
                cmd.CommandText = "CREATE TABLE IF NOT EXISTS _mapping_tracking (table_name TEXT)";
                cmd.ExecuteNonQuery();
            }

            foreach (var table in tables)
            {
                var escaped = table.Replace("'", "''");
                var quoted = "\"" + table.Replace("\"", "\"\"") + "\"";

                foreach (var op in new[] { "INSERT", "UPDATE", "DELETE" })
                {
                    try
                    {
                        using (var cmd = Connection.CreateCommand())
                        {
                            cmd.CommandText =
                                $"CREATE TRIGGER IF NOT EXISTS \"_track_{table}_{op}\" " +
                                $"AFTER {op} ON {quoted} " +
                                $"BEGIN INSERT INTO _mapping_tracking VALUES ('{escaped}'); END";
                            cmd.ExecuteNonQuery();
                        }
                    }
                    catch (Exception e)
                    {
                        Lib.LogDebug($"Failed to create trigger for {table}/{op}: {e.Message}");
                    }
                }
            }
        }

        private void ClearTracking()
        {
            using (var cmd = Connection.CreateCommand())
            {
                cmd.CommandText = "DELETE FROM _mapping_tracking";
                cmd.ExecuteNonQuery();
            }
        }

        private List<string> GetTrackedTables()
        {
            var tables = new List<string>();
            using (var cmd = Connection.CreateCommand())
            {
                cmd.CommandText = "SELECT DISTINCT table_name FROM _mapping_tracking";
                using (var reader = cmd.ExecuteReader())
                {
                    while (reader.Read())
                        tables.Add(reader.GetString(0));
                }
            }
            return tables;
        }

        private void CleanupTracking(List<string> tables)
        {
            foreach (var table in tables)
            {
                foreach (var op in new[] { "INSERT", "UPDATE", "DELETE" })
                {
                    try
                    {
                        using (var cmd = Connection.CreateCommand())
                        {
                            cmd.CommandText = $"DROP TRIGGER IF EXISTS \"_track_{table}_{op}\"";
                            cmd.ExecuteNonQuery();
                        }
                    }
                    catch { }
                }
            }

            try
            {
                using (var cmd = Connection.CreateCommand())
                {
                    cmd.CommandText = "DROP TABLE IF EXISTS _mapping_tracking";
                    cmd.ExecuteNonQuery();
                }
            }
            catch { }
        }

        // =====================================================================
        // Save methods
        // =====================================================================

        private void SaveAll()
        {
            var map = Lib.TacticalMap;
            if (map == null) return;

            var game = Lib.KnowledgeBase.GetGameState(map);
            if (game == null) return;

            var methods = Lib.KnowledgeBase.GetSaveMethods();
            if (methods.Count == 0) return;

            SaveMethods(methods, game);
        }

        private void SaveMethods(List<MethodInfo> methods)
        {
            var map = Lib.TacticalMap;
            if (map == null) return;

            var game = Lib.KnowledgeBase.GetGameState(map);
            if (game == null) return;

            SaveMethods(methods, game);
        }

        private void SaveMethods(List<MethodInfo> methods, object game)
        {
            if (methods.Count == 0) return;

            var connection = OpenReflectionConnection(methods[0]);
            var transaction = BeginReflectionTransaction(connection);

            foreach (var method in methods)
            {
                method.Invoke(game, new object[] { connection });
                Lib.LogDebug($"Called function {method.Name}");
            }

            CommitAndClose(transaction, connection);
        }

        // =====================================================================
        // Helpers
        // =====================================================================

        private void EnsureDatabase()
        {
            lock (this)
            {
                if (Connection == null)
                {
                    try
                    {
                        GenerateDatabase();
                    }
                    catch (Exception e)
                    {
                        Lib.LogError($"DatabaseManager failed to create in-memory db. {e}");
                    }
                }
            }
        }

        private DataTable RunQuery(string sql)
        {
            try
            {
                using (var connection = new SQLiteConnection(Connection.ConnectionString))
                using (var adapter = new SQLiteDataAdapter(sql, connection))
                {
                    connection.Open();
                    var data = new DataSet();
                    adapter.Fill(data, "RecordSet");
                    connection.Close();
                    return data.Tables["RecordSet"];
                }
            }
            catch (Exception e)
            {
                Lib.LogError($"DatabaseManager failed to run query {sql}. {e}");
            }
            return null;
        }

        private object OpenReflectionConnection(MethodInfo anyMethod)
        {
            var type = anyMethod.GetParameters()[0].ParameterType;
            var connection = Activator.CreateInstance(type, Connection.ConnectionString);
            connection.GetType().GetMethod("Open").Invoke(connection, new object[0]);
            return connection;
        }

        private object BeginReflectionTransaction(object connection)
        {
            var beginTransaction = connection.GetType().GetMethods().Single(m =>
                m.Name == "BeginTransaction"
                && m.ReturnType.Name == "SQLiteTransaction"
                && m.GetParameters().Count() == 0);

            return beginTransaction.Invoke(connection, new object[0]);
        }

        private void CommitAndClose(object transaction, object connection)
        {
            if (transaction != null)
                transaction.GetType().GetMethod("Commit").Invoke(transaction, new object[0]);
            if (connection != null)
                connection.GetType().GetMethod("Close").Invoke(connection, new object[0]);
        }

        private List<string> GetManagedTableNames()
        {
            var tables = new List<string>();
            using (var cmd = Connection.CreateCommand())
            {
                cmd.CommandText = "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name";
                using (var reader = cmd.ExecuteReader())
                {
                    while (reader.Read())
                    {
                        var name = reader.GetString(0);
                        if (!string.IsNullOrEmpty(name))
                            tables.Add(name);
                    }
                }
            }
            return tables;
        }

        private void GenerateDatabase()
        {
            var commands = new List<string>();

            Lib.LogInfo("Getting sql commands");
            using (var connection = new SQLiteConnection("Data Source=AuroraDB.db;Version=3;New=False;Compress=True;"))
            {
                connection.Open();

                var command = connection.CreateCommand();
                command.CommandText = "SELECT sql FROM sqlite_master";

                using (var reader = command.ExecuteReader())
                {
                    while (reader.Read())
                    {
                        var entry = reader.GetValue(0);

                        if (!(entry is DBNull))
                        {
                            var sql = (string)entry;
                            if (!sql.Contains("sqlite_"))
                            {
                                commands.Add(sql);
                            }
                        }
                    }
                }

                connection.Close();
            }

            Lib.LogInfo("Applying sql commands");
            Connection = new SQLiteConnection("FullUri=file::memory:?cache=shared;");
            Connection.Open();

            foreach (var sql in commands)
            {
                Lib.LogDebug($"executing sql: {sql}");

                var command = Connection.CreateCommand();
                command.CommandText = sql;
                command.ExecuteNonQuery();
            }
        }
    }
}
