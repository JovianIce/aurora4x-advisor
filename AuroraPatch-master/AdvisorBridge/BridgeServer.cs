using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Net;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Newtonsoft.Json;

namespace AdvisorBridge
{
    public class BridgeServer
    {
        private readonly Lib.DatabaseManager _db;
        private readonly AuroraPatch.Patch _patch;
        private readonly MemoryReader _memoryReader;
        private readonly ActionExecutor _actionExecutor;
        private HttpListener _listener;
        private CancellationTokenSource _cts;
        private readonly ConcurrentDictionary<string, WebSocket> _clients = new ConcurrentDictionary<string, WebSocket>();

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
        }

        public void Start(int port = 47842)
        {
            Port = port;
            _cts = new CancellationTokenSource();

            var thread = new Thread(() => RunServer(_cts.Token))
            {
                IsBackground = true,
                Name = "AdvisorBridge-Server"
            };
            thread.Start();
        }

        public void Stop()
        {
            IsRunning = false;
            _cts?.Cancel();

            foreach (var kvp in _clients)
            {
                try
                {
                    kvp.Value.CloseAsync(WebSocketCloseStatus.NormalClosure, "Server stopping", CancellationToken.None).Wait(1000);
                }
                catch { }
            }
            _clients.Clear();

            try { _listener?.Stop(); } catch { }
        }

        private void RunServer(CancellationToken ct)
        {
            try
            {
                _listener = new HttpListener();
                _listener.Prefixes.Add($"http://localhost:{Port}/");
                _listener.Start();
                IsRunning = true;

                _patch.LogInfo($"AdvisorBridge WebSocket server listening on ws://localhost:{Port}/");

                while (!ct.IsCancellationRequested)
                {
                    try
                    {
                        var context = _listener.GetContext();

                        if (context.Request.IsWebSocketRequest)
                        {
                            Task.Run(() => HandleWebSocketClient(context, ct));
                        }
                        else
                        {
                            // Return a simple status for HTTP requests
                            var response = context.Response;
                            var body = Encoding.UTF8.GetBytes("{\"status\":\"ok\",\"bridge\":\"AdvisorBridge\"}");
                            response.ContentType = "application/json";
                            response.ContentLength64 = body.Length;
                            response.OutputStream.Write(body, 0, body.Length);
                            response.Close();
                        }
                    }
                    catch (HttpListenerException) when (ct.IsCancellationRequested)
                    {
                        break;
                    }
                    catch (Exception ex)
                    {
                        _patch.LogError($"BridgeServer accept error: {ex.Message}");
                    }
                }
            }
            catch (Exception ex)
            {
                _patch.LogError($"BridgeServer failed to start: {ex}");
            }
            finally
            {
                IsRunning = false;
            }
        }

        private async Task HandleWebSocketClient(HttpListenerContext httpContext, CancellationToken ct)
        {
            var clientId = Guid.NewGuid().ToString("N").Substring(0, 8);
            WebSocket ws = null;

            try
            {
                var wsContext = await httpContext.AcceptWebSocketAsync(null);
                ws = wsContext.WebSocket;
                _clients[clientId] = ws;

                _patch.LogInfo($"Client {clientId} connected");

                var buffer = new byte[8192];

                while (ws.State == WebSocketState.Open && !ct.IsCancellationRequested)
                {
                    var result = await ws.ReceiveAsync(new ArraySegment<byte>(buffer), ct);

                    if (result.MessageType == WebSocketMessageType.Close)
                    {
                        await ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "Client disconnected", CancellationToken.None);
                        break;
                    }

                    if (result.MessageType == WebSocketMessageType.Text)
                    {
                        var message = Encoding.UTF8.GetString(buffer, 0, result.Count);
                        var response = HandleMessage(message, clientId);
                        var responseBytes = Encoding.UTF8.GetBytes(response);

                        await ws.SendAsync(
                            new ArraySegment<byte>(responseBytes),
                            WebSocketMessageType.Text,
                            true,
                            ct
                        );
                    }
                }
            }
            catch (OperationCanceledException) { }
            catch (WebSocketException ex)
            {
                _patch.LogError($"Client {clientId} WebSocket error: {ex.Message}");
            }
            catch (Exception ex)
            {
                _patch.LogError($"Client {clientId} error: {ex.Message}");
            }
            finally
            {
                WebSocket removed;
                _clients.TryRemove(clientId, out removed);
                _patch.LogInfo($"Client {clientId} disconnected");

                if (ws != null && ws.State != WebSocketState.Closed)
                {
                    try { ws.Dispose(); } catch { }
                }
            }
        }

        private string HandleMessage(string rawMessage, string clientId = null)
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
                case "ping":
                    response = BridgeResponse.Ok(request.Id, "pong", null);
                    break;

                case "query":
                    response = HandleQuery(request);
                    break;

                case "getsystembodies":
                    response = HandleGetSystemBodies(request);
                    break;

                case "getbodies":
                    response = HandleGetBodies(request);
                    break;

                case "getsystems":
                    response = HandleGetSystems(request);
                    break;

                case "subscribe":
                    response = HandleSubscribe(request, clientId);
                    break;

                case "globalsearch":
                    response = HandleGlobalSearch(request);
                    break;

                case "action":
                    response = HandleAction(request);
                    break;

                case "inspect":
                    response = HandleInspect(request);
                    break;

                default:
                    response = BridgeResponse.Fail(request.Id, "error", $"Unknown message type: {request.Type}");
                    break;
            }

            return JsonConvert.SerializeObject(response);
        }

        private BridgeResponse HandleQuery(BridgeRequest request)
        {
            try
            {
                var payload = JsonConvert.DeserializeObject<QueryPayload>(request.Payload);
                if (payload == null || string.IsNullOrWhiteSpace(payload.Sql))
                {
                    return BridgeResponse.Fail(request.Id, "result", "Missing 'sql' in payload");
                }

                if (!QueryHandler.IsSafeQuery(payload.Sql))
                {
                    return BridgeResponse.Fail(request.Id, "result", "Only SELECT and PRAGMA queries are allowed");
                }

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

        private BridgeResponse HandleSubscribe(BridgeRequest request, string clientId)
        {
            try
            {
                int? systemId = null;
                if (!string.IsNullOrEmpty(request.Payload))
                {
                    var payload = JsonConvert.DeserializeObject<SystemBodiesPayload>(request.Payload);
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
            if (_clients.IsEmpty || !_subscribedSystemId.HasValue) return;

            try
            {
                var bodies = _memoryReader.ReadBodies(_subscribedSystemId);
                Broadcast("bodies", new { systemId = _subscribedSystemId.Value, bodies });
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

            var bytes = Encoding.UTF8.GetBytes(msg);

            foreach (var kvp in _clients)
            {
                try
                {
                    if (kvp.Value.State == WebSocketState.Open)
                    {
                        kvp.Value.SendAsync(
                            new ArraySegment<byte>(bytes),
                            WebSocketMessageType.Text,
                            true,
                            CancellationToken.None
                        ).Wait(1000);
                    }
                }
                catch { }
            }
        }

        private BridgeResponse HandleGetSystemBodies(BridgeRequest request)
        {
            try
            {
                int? systemId = null;
                if (!string.IsNullOrEmpty(request.Payload))
                {
                    try
                    {
                        var payload = JsonConvert.DeserializeObject<SystemBodiesPayload>(request.Payload);
                        systemId = payload?.SystemId;
                    }
                    catch { }
                }

                var bodies = _memoryReader.ReadStars(systemId);
                return BridgeResponse.Ok(request.Id, "result", bodies);
            }
            catch (Exception ex)
            {
                _patch.LogError($"GetSystemBodies error: {ex.Message}");
                return BridgeResponse.Fail(request.Id, "result", $"Failed: {ex.Message}");
            }
        }

        private BridgeResponse HandleGetBodies(BridgeRequest request)
        {
            try
            {
                int? systemId = null;
                if (!string.IsNullOrEmpty(request.Payload))
                {
                    try
                    {
                        var payload = JsonConvert.DeserializeObject<SystemBodiesPayload>(request.Payload);
                        systemId = payload?.SystemId;
                    }
                    catch { }
                }

                var bodies = _memoryReader.ReadBodies(systemId);
                return BridgeResponse.Ok(request.Id, "result", bodies);
            }
            catch (Exception ex)
            {
                _patch.LogError($"GetBodies error: {ex.Message}");
                return BridgeResponse.Fail(request.Id, "result", $"Failed: {ex.Message}");
            }
        }

        private BridgeResponse HandleGetSystems(BridgeRequest request)
        {
            try
            {
                var systems = _memoryReader.ReadSystems();
                return BridgeResponse.Ok(request.Id, "result", systems);
            }
            catch (Exception ex)
            {
                _patch.LogError($"GetSystems error: {ex.Message}");
                return BridgeResponse.Fail(request.Id, "result", $"Failed: {ex.Message}");
            }
        }

        private BridgeResponse HandleGlobalSearch(BridgeRequest request)
        {
            try
            {
                int[] searchValues = new int[] { 2008597, 21859 };
                if (!string.IsNullOrEmpty(request.Payload))
                {
                    try
                    {
                        var payload = JsonConvert.DeserializeObject<GlobalSearchPayload>(request.Payload);
                        if (payload?.Values != null) searchValues = payload.Values;
                    }
                    catch { }
                }

                var hits = _memoryReader.GlobalSearch(searchValues);
                return BridgeResponse.Ok(request.Id, "result", hits);
            }
            catch (Exception ex)
            {
                _patch.LogError($"GlobalSearch error: {ex.Message}");
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
                    try
                    {
                        var payload = JsonConvert.DeserializeObject<InspectPayload>(request.Payload);
                        if (!string.IsNullOrEmpty(payload?.FormName))
                            formName = payload.FormName;
                    }
                    catch { }
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

        private class InspectPayload
        {
            public string FormName { get; set; }
        }

        private class GlobalSearchPayload
        {
            public int[] Values { get; set; }
        }

        private class SystemBodiesPayload
        {
            public int? SystemId { get; set; }
        }

        private class QueryPayload
        {
            public string Sql { get; set; }
        }
    }
}
