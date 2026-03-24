using HarmonyLib;
using System;
using System.Collections.Generic;
using System.Data;
using System.Data.SQLite;
using System.Diagnostics;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Windows.Forms;

namespace Lib
{
    /// <summary>
    /// Maintains an in-memory SQLite database that mirrors Aurora's game state.
    ///
    /// Why in-memory: Aurora only writes to AuroraDB.db when the player manually saves,
    /// and the save process takes several seconds. The on-disk DB is therefore stale during
    /// gameplay — it reflects the last save, not the current game state. For real-time data
    /// we need a different approach.
    ///
    /// How it works:
    ///   1. Read AuroraDB.db's schema on first use (DDL only, no data)
    ///   2. Create a shared in-memory SQLite database with the same schema
    ///   3. On explicit request (Refresh()), invoke Aurora's own Save methods (via reflection)
    ///      to serialize the live GameState object into our in-memory connection
    ///
    /// Performance warning: the Refresh() call invokes Aurora's save routines on the UI thread,
    /// which can cause noticeable lag (several seconds depending on game size). It should only
    /// be triggered when the user explicitly requests fresh data, not on a timer.
    ///
    /// The Save methods are found by scanning GameState for methods that take a single
    /// SQLiteConnection parameter — these are Aurora's built-in serialization routines.
    /// We call them with our in-memory connection instead of the file-backed one.
    ///
    /// Thread safety: all access is synchronized via lock(Connection). The Save call is
    /// marshalled to the UI thread since Aurora's GameState is owned by the UI thread.
    /// </summary>
    public class DatabaseManager
    {
        private readonly Lib Lib;
        private SQLiteConnection Connection { get; set; } = null;
        private bool _needsRefresh = true;

        internal DatabaseManager(Lib lib)
        {
            Lib = lib;
        }

        /// <summary>
        /// Mark the in-memory DB as stale so the next query triggers a refresh.
        /// Call this when the user explicitly requests fresh data.
        /// </summary>
        public void Refresh()
        {
            _needsRefresh = true;
        }

        public DataTable ExecuteQuery(string query)
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

            lock (Connection)
            {
                if (_needsRefresh)
                {
                    try
                    {
                        var sw = new Stopwatch();
                        sw.Start();

                        Lib.InvokeOnUIThread(new Action(() => Save()));
                        _needsRefresh = false;

                        sw.Stop();
                        Lib.LogInfo($"In-memory save took {sw.ElapsedMilliseconds} ms");
                    }
                    catch (Exception e)
                    {
                        Lib.LogError($"DatabaseManager failed to save. {e}");
                    }
                }

                try
                {
                    using (var connection = new SQLiteConnection(Connection.ConnectionString))
                    using (var adapter = new SQLiteDataAdapter(query, connection))
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
                    Lib.LogError($"DatabaseManager failed to run query {query}. {e}");
                }
            }

            return null;
        }

        private void Save()
        {
            var map = Lib.TacticalMap;
            if (map == null)
            {
                return;
            }

            var game = Lib.KnowledgeBase.GetGameState(map);
            if (game == null)
            {
                return;
            }

            var methods = Lib.KnowledgeBase.GetSaveMethods();
            if (methods.Count == 0)
            {
                return;
            }

            object connection = null;
            object transaction = null;
            foreach (var method in methods)
            {
                if (connection == null)
                {
                    var type = method.GetParameters()[0].ParameterType;
                    connection = Activator.CreateInstance(type, Connection.ConnectionString);
                    connection.GetType().GetMethod("Open").Invoke(connection, new object[0]);

                    var begintransaction = connection.GetType().GetMethods().Single(m =>
                    {
                        if (m.Name != "BeginTransaction")
                        {
                            return false;
                        }

                        if (m.ReturnType.Name != "SQLiteTransaction")
                        {
                            return false;
                        }

                        if (m.GetParameters().Count() != 0)
                        {
                            return false;
                        }

                        return true;
                    });

                    transaction = begintransaction.Invoke(connection, new object[0]);
                }

                method.Invoke(game, new object[] { connection });
                Lib.LogDebug($"Called function {method.Name}");
            }

            if (transaction != null)
            {
                transaction.GetType().GetMethod("Commit").Invoke(transaction, new object[0]);
            }

            if (connection != null)
            {
                connection.GetType().GetMethod("Close").Invoke(connection, new object[0]);
            }
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
