using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Text;
using System.Windows.Forms;
using AdvisorBridge.Providers;
using Fleck;
using Newtonsoft.Json;

namespace AdvisorBridge
{
    /// <summary>
    /// WebSocket server that runs inside Aurora's process, bridging the Electron frontend
    /// to live game state. Uses Fleck (raw TCP sockets) for Wine/Proton compatibility.
    ///
    /// Communication model:
    ///   - Request/Response: client sends JSON BridgeRequest, gets BridgeResponse back
    ///   - Push: server broadcasts game state changes to all connected clients on each game tick
    ///
    /// Tick detection: hooks TacticalMap.TextChanged (Aurora updates the title bar text on every
    /// time increment), which triggers a broadcast of subscribed system bodies and fleet positions.
    ///
    /// Data access is delegated to domain-specific providers:
    ///   - FleetProvider:      fleets, ships (SQL + memory)
    ///   - SystemProvider:     systems, stars, bodies, minerals (SQL + memory)
    ///   - GameStateExplorer:  generic game state inspection (memory only)
    ///   - ActionExecutor:     UI automation (button clicks, form inspection)
    /// </summary>
    public class BridgeServer
    {
        private readonly Lib.DatabaseManager _db;
        private readonly AuroraPatch.Patch _patch;
        private readonly MemoryReader _memoryReader;
        private readonly ActionExecutor _actionExecutor;

        // Domain providers
        private readonly FleetProvider _fleets;
        private readonly SystemProvider _systems;
        private readonly GameStateExplorer _explorer;

        private WebSocketServer _server;
        private readonly ConcurrentDictionary<Guid, IWebSocketConnection> _clients = new ConcurrentDictionary<Guid, IWebSocketConnection>();

        public int Port { get; private set; }
        public bool IsRunning { get; private set; }

        // Change detection for push notifications
        private int? _subscribedSystemId;
        private bool _hookInstalled;

        public BridgeServer(Lib.DatabaseManager db, AuroraPatch.Patch patch, Lib.Lib lib)
        {
            _db = db;
            _patch = patch;
            _memoryReader = new MemoryReader(lib, patch);
            _actionExecutor = new ActionExecutor(lib, patch);

            // Initialize domain providers
            _fleets = new FleetProvider(db, _memoryReader, patch);
            _systems = new SystemProvider(db, _memoryReader, patch);
            _explorer = new GameStateExplorer(_memoryReader, patch);
        }

        public void Start(int port = 47842)
        {
            Port = port;

            _server = new WebSocketServer($"ws://0.0.0.0:{port}");
            _server.Start(socket =>
            {
                socket.OnOpen = () =>
                {
                    _clients[socket.ConnectionInfo.Id] = socket;
                    _patch.LogInfo($"Client {socket.ConnectionInfo.Id.ToString("N").Substring(0, 8)} connected");

                    // Install tick hook and send current game date on connect
                    InstallTickHook();
                    var map = _patch.TacticalMap;
                    if (map != null)
                    {
                        try
                        {
                            var titleText = (string)map.Invoke((Func<string>)(() => map.Text));
                            if (!string.IsNullOrEmpty(titleText))
                            {
                                Broadcast("gameDate", new { raw = titleText });
                            }
                        }
                        catch (Exception ex)
                        {
                            _patch.LogError($"Failed to read TacticalMap title: {ex.Message}");
                        }
                    }
                };

                socket.OnClose = () =>
                {
                    IWebSocketConnection removed;
                    _clients.TryRemove(socket.ConnectionInfo.Id, out removed);
                    _patch.LogInfo($"Client {socket.ConnectionInfo.Id.ToString("N").Substring(0, 8)} disconnected");
                };

                socket.OnMessage = message =>
                {
                    var response = HandleMessage(message);
                    socket.Send(response);
                };

                socket.OnError = ex =>
                {
                    _patch.LogError($"Client {socket.ConnectionInfo.Id.ToString("N").Substring(0, 8)} error: {ex.Message}");
                    IWebSocketConnection removed;
                    _clients.TryRemove(socket.ConnectionInfo.Id, out removed);
                };
            });

            IsRunning = true;
            _patch.LogInfo($"AdvisorBridge WebSocket server listening on ws://localhost:{port}/");
        }

        public void Stop()
        {
            IsRunning = false;

            foreach (var kvp in _clients)
            {
                try
                {
                    kvp.Value.Close();
                }
                catch { }
            }
            _clients.Clear();

            try { _server?.Dispose(); } catch { }
        }

        // -----------------------------------------------------------------
        // Tick detection & push
        // -----------------------------------------------------------------

        private void InstallTickHook()
        {
            if (_hookInstalled) return;

            var map = _patch.TacticalMap;
            if (map == null) return;

            map.TextChanged += OnGameTick;
            _hookInstalled = true;
            _patch.LogInfo("Installed TextChanged hook on TacticalMap for tick detection");
        }

        private void OnGameTick(object sender, EventArgs e)
        {
            if (_clients.IsEmpty) return;

            // Mark SQL tables stale on each tick so selective refresh picks up changes
            _db.MarkAllStale();

            try
            {
                // Extract current game date from TacticalMap title bar
                if (sender is Form form)
                {
                    var titleText = form.Text;
                    if (!string.IsNullOrEmpty(titleText))
                    {
                        Broadcast("gameDate", new { raw = titleText });
                    }
                }

                if (_subscribedSystemId.HasValue)
                {
                    var bodies = _memoryReader.ReadBodies(_subscribedSystemId);
                    Broadcast("bodies", new { systemId = _subscribedSystemId.Value, bodies });
                }

                var fleets = _memoryReader.ReadFleets();
                Broadcast("fleets", new { fleets });
            }
            catch (Exception ex)
            {
                _patch.LogError($"OnGameTick broadcast error: {ex.Message}");
            }
        }

        /// <summary>
        /// Broadcast a push notification to all connected clients.
        /// </summary>
        public void Broadcast(string pushType, object data)
        {
            var msg = JsonConvert.SerializeObject(new BridgeResponse
            {
                Id = null,
                Type = "push",
                Payload = new { pushType, data },
                Success = true,
                Error = null
            });

            foreach (var kvp in _clients)
            {
                try
                {
                    if (kvp.Value.IsAvailable)
                    {
                        kvp.Value.Send(msg);
                    }
                }
                catch { }
            }
        }

        // -----------------------------------------------------------------
        // Message routing
        // -----------------------------------------------------------------

        private string HandleMessage(string rawMessage)
        {
            BridgeRequest request;
            try
            {
                request = JsonConvert.DeserializeObject<BridgeRequest>(rawMessage);
            }
            catch (Exception ex)
            {
                var err = BridgeResponse.Fail(null, "error", $"Invalid JSON: {ex.Message}");
                return JsonConvert.SerializeObject(err);
            }

            BridgeResponse response;

            switch (request.Type?.ToLowerInvariant())
            {
                // Infrastructure
                case "ping":
                    response = BridgeResponse.Ok(request.Id, "pong", new { protocolVersion = BridgeProtocol.Version });
                    break;

                case "subscribe":
                    response = HandleSubscribe(request);
                    break;

                // SQL query — auto-detects FCT_* tables and selectively refreshes
                case "query":
                    response = HandleSmartQuery(request);
                    break;

                // Full refresh query — for PRAGMA, sqlite_master, or explicit full refresh
                case "query.full":
                    response = HandleFullQuery(request);
                    break;

                // Fleets & Ships — real-time memory reader
                case "getfleets":
                    response = Handle(request, () => _fleets.GetFleets());
                    break;

                case "getships":
                    response = Handle(request, () =>
                    {
                        var payload = ParsePayload<ShipsPayload>(request);
                        return _fleets.GetShips(payload?.FleetId);
                    });
                    break;

                // Systems, Stars, Bodies — real-time memory reader
                case "getsystems":
                    response = Handle(request, () => _systems.GetSystems());
                    break;

                case "getknownsystems":
                    response = Handle(request, () => _systems.GetKnownSystems());
                    break;

                case "getsystembodies":
                    response = Handle(request, () =>
                    {
                        var payload = ParsePayload<SystemIdPayload>(request);
                        return _systems.GetStars(payload?.SystemId);
                    });
                    break;

                case "getbodies":
                    response = Handle(request, () =>
                    {
                        var payload = ParsePayload<SystemIdPayload>(request);
                        return _systems.GetBodies(payload?.SystemId);
                    });
                    break;

                // GameState exploration (delegated to GameStateExplorer)
                case "enumerategamestate":
                    response = Handle(request, () => _explorer.EnumerateGameState());
                    break;

                case "enumeratecollections":
                    response = Handle(request, () => _explorer.EnumerateCollections());
                    break;

                case "readcollection":
                    response = HandleReadCollection(request);
                    break;

                case "readfield":
                    response = Handle(request, () =>
                    {
                        var payload = ParsePayload<ReadFieldPayload>(request);
                        if (string.IsNullOrEmpty(payload?.Field))
                            throw new ArgumentException("Missing 'Field' in payload");
                        return _explorer.ReadField(payload.Field);
                    });
                    break;

                case "globalsearch":
                    response = Handle(request, () =>
                    {
                        int[] searchValues = new int[] { 2008597, 21859 };
                        var payload = ParsePayload<GlobalSearchPayload>(request);
                        if (payload?.Values != null) searchValues = payload.Values;
                        return _explorer.GlobalSearch(searchValues);
                    });
                    break;

                // Actions
                case "action":
                    response = HandleAction(request);
                    break;

                case "inspect":
                    response = HandleInspect(request);
                    break;

                // Diagnostics
                case "gettablemapping":
                    response = HandleGetTableMapping(request);
                    break;

                case "rediscovermapping":
                    response = Handle(request, () =>
                    {
                        _db.RediscoverMapping();
                        // Trigger discovery by running a query
                        _db.ExecuteQuery("SELECT 1");
                        return new
                        {
                            discovered = _db.HasMapping,
                            mapping = _db.GetMethodTableMapping()
                        };
                    });
                    break;

                default:
                    response = BridgeResponse.Fail(request.Id, "error", $"Unknown message type: {request.Type}");
                    break;
            }

            return JsonConvert.SerializeObject(response);
        }

        // -----------------------------------------------------------------
        // Generic handler wrapper — reduces boilerplate
        // -----------------------------------------------------------------

        private BridgeResponse Handle(BridgeRequest request, Func<object> handler)
        {
            try
            {
                var result = handler();
                return BridgeResponse.Ok(request.Id, "result", result);
            }
            catch (Exception ex)
            {
                _patch.LogError($"{request.Type} error: {ex.Message}");
                return BridgeResponse.Fail(request.Id, "result", $"Failed: {ex.Message}");
            }
        }

        private T ParsePayload<T>(BridgeRequest request) where T : class
        {
            if (string.IsNullOrEmpty(request.Payload)) return null;
            try { return JsonConvert.DeserializeObject<T>(request.Payload); }
            catch { return null; }
        }

        // -----------------------------------------------------------------
        // Handlers that need custom logic
        // -----------------------------------------------------------------

        /// <summary>
        /// Smart query: auto-detects FCT_* tables in the SQL and selectively refreshes them.
        /// Handles joins, subqueries, etc. automatically.
        /// </summary>
        private BridgeResponse HandleSmartQuery(BridgeRequest request)
        {
            try
            {
                var payload = JsonConvert.DeserializeObject<QueryPayload>(request.Payload);
                if (payload == null || string.IsNullOrWhiteSpace(payload.Sql))
                    return BridgeResponse.Fail(request.Id, "result", "Missing 'sql' in payload");

                if (!QueryHandler.IsSafeQuery(payload.Sql))
                    return BridgeResponse.Fail(request.Id, "result", "Only SELECT and PRAGMA queries are allowed");

                var tables = Lib.DatabaseManager.ExtractTableNames(payload.Sql);
                var table = (tables.Length > 0)
                    ? _db.QueryTables(payload.Sql, tables)
                    : _db.ExecuteQuery(payload.Sql);

                var rows = QueryHandler.DataTableToList(table);
                return BridgeResponse.Ok(request.Id, "result", rows);
            }
            catch (Exception ex)
            {
                _patch.LogError($"Query error: {ex.Message}");
                return BridgeResponse.Fail(request.Id, "result", $"Query failed: {ex.Message}");
            }
        }

        /// <summary>
        /// Full refresh query — for PRAGMA, sqlite_master, or when you explicitly need everything.
        /// </summary>
        private BridgeResponse HandleFullQuery(BridgeRequest request)
        {
            try
            {
                var payload = JsonConvert.DeserializeObject<QueryPayload>(request.Payload);
                if (payload == null || string.IsNullOrWhiteSpace(payload.Sql))
                    return BridgeResponse.Fail(request.Id, "result", "Missing 'sql' in payload");

                if (!QueryHandler.IsSafeQuery(payload.Sql))
                    return BridgeResponse.Fail(request.Id, "result", "Only SELECT and PRAGMA queries are allowed");

                var table = _db.ExecuteQuery(payload.Sql);
                var rows = QueryHandler.DataTableToList(table);
                return BridgeResponse.Ok(request.Id, "result", rows);
            }
            catch (Exception ex)
            {
                _patch.LogError($"Query error: {ex.Message}");
                return BridgeResponse.Fail(request.Id, "result", $"Query failed: {ex.Message}");
            }
        }

        private BridgeResponse HandleSubscribe(BridgeRequest request)
        {
            try
            {
                int? systemId = null;
                if (!string.IsNullOrEmpty(request.Payload))
                {
                    var payload = JsonConvert.DeserializeObject<SystemIdPayload>(request.Payload);
                    systemId = payload?.SystemId;
                }

                _subscribedSystemId = systemId;
                InstallTickHook();

                _patch.LogInfo($"Client subscribed to system {systemId}");
                return BridgeResponse.Ok(request.Id, "subscribed", systemId);
            }
            catch (Exception ex)
            {
                return BridgeResponse.Fail(request.Id, "error", ex.Message);
            }
        }

        private BridgeResponse HandleReadCollection(BridgeRequest request)
        {
            try
            {
                if (string.IsNullOrEmpty(request.Payload))
                    return BridgeResponse.Fail(request.Id, "result", "Missing payload with 'Field' name");

                var payload = JsonConvert.DeserializeObject<ReadCollectionPayload>(request.Payload);
                if (string.IsNullOrEmpty(payload?.Field))
                    return BridgeResponse.Fail(request.Id, "result", "Missing 'Field' in payload");

                var items = _explorer.ReadCollection(
                    payload.Field,
                    payload.Offset,
                    payload.Limit > 0 ? payload.Limit : 100,
                    payload.Fields,
                    payload.IncludeRefs,
                    payload.FilterField,
                    payload.FilterValue
                );
                return BridgeResponse.Ok(request.Id, "result", items);
            }
            catch (Exception ex)
            {
                _patch.LogError($"ReadCollection error: {ex.Message}");
                return BridgeResponse.Fail(request.Id, "result", $"Failed: {ex.Message}");
            }
        }

        private BridgeResponse HandleAction(BridgeRequest request)
        {
            try
            {
                if (string.IsNullOrEmpty(request.Payload))
                    return BridgeResponse.Fail(request.Id, "result", "Missing action payload");

                var actionRequest = JsonConvert.DeserializeObject<ActionRequest>(request.Payload);
                var result = _actionExecutor.Execute(actionRequest);

                if (result.Success)
                    return BridgeResponse.Ok(request.Id, "result", result.Data);
                else
                    return BridgeResponse.Fail(request.Id, "result", result.Error);
            }
            catch (Exception ex)
            {
                _patch.LogError($"Action error: {ex.Message}");
                return BridgeResponse.Fail(request.Id, "result", $"Action failed: {ex.Message}");
            }
        }

        private BridgeResponse HandleInspect(BridgeRequest request)
        {
            try
            {
                string formName = "EconomicsForm";
                if (!string.IsNullOrEmpty(request.Payload))
                {
                    var payload = ParsePayload<InspectPayload>(request);
                    if (!string.IsNullOrEmpty(payload?.FormName))
                        formName = payload.FormName;
                }

                var actionRequest = new ActionRequest
                {
                    Action = ActionType.InspectForm,
                    Target = formName
                };

                var result = _actionExecutor.Execute(actionRequest);

                if (result.Success)
                    return BridgeResponse.Ok(request.Id, "result", result.Data);
                else
                    return BridgeResponse.Fail(request.Id, "result", result.Error);
            }
            catch (Exception ex)
            {
                _patch.LogError($"Inspect error: {ex.Message}");
                return BridgeResponse.Fail(request.Id, "result", $"Inspect failed: {ex.Message}");
            }
        }

        private BridgeResponse HandleGetTableMapping(BridgeRequest request)
        {
            try
            {
                if (!_db.HasMapping)
                {
                    return BridgeResponse.Ok(request.Id, "result", new
                    {
                        discovered = false,
                        message = "Mapping not yet discovered. Send a query first to trigger discovery."
                    });
                }

                return BridgeResponse.Ok(request.Id, "result", new
                {
                    discovered = true,
                    mapping = _db.GetMethodTableMapping()
                });
            }
            catch (Exception ex)
            {
                return BridgeResponse.Fail(request.Id, "result", $"Failed: {ex.Message}");
            }
        }

        // -----------------------------------------------------------------
        // Payload DTOs
        // -----------------------------------------------------------------

        private class SystemIdPayload
        {
            public int? SystemId { get; set; }
        }

        private class ShipsPayload
        {
            public int? FleetId { get; set; }
        }

        private class QueryPayload
        {
            public string Sql { get; set; }
        }

        private class ReadCollectionPayload
        {
            public string Field { get; set; }
            public int Offset { get; set; }
            public int Limit { get; set; }
            public string[] Fields { get; set; }
            public bool IncludeRefs { get; set; }
            public string FilterField { get; set; }
            public string FilterValue { get; set; }
        }

        private class ReadFieldPayload
        {
            public string Field { get; set; }
        }

        private class GlobalSearchPayload
        {
            public int[] Values { get; set; }
        }

        private class InspectPayload
        {
            public string FormName { get; set; }
        }
    }
}
