namespace AdvisorBridge
{
    /// <summary>
    /// Protocol version. Bump this when the bridge API changes in a breaking way.
    /// The Electron app checks this on connect and warns the user if mismatched.
    /// </summary>
    public static class BridgeProtocol
    {
        public const int Version = 1;
    }

    /// <summary>
    /// Incoming message from the Electron frontend.
    /// Id is a client-generated correlation ID returned in the response.
    /// Type determines the handler (e.g. "query", "getbodies", "action", "subscribe").
    /// Payload is a JSON string whose schema depends on Type.
    /// </summary>
    public class BridgeRequest
    {
        public string Id { get; set; }
        public string Type { get; set; }
        public string Payload { get; set; }
    }

    /// <summary>
    /// Response sent back to the frontend. For request/response, Id matches the request.
    /// For push notifications (game tick broadcasts), Id is null and Type is "push".
    /// </summary>
    public class BridgeResponse
    {
        public string Id { get; set; }
        public string Type { get; set; }
        public object Payload { get; set; }
        public bool Success { get; set; }
        public string Error { get; set; }

        public static BridgeResponse Ok(string id, string type, object payload)
        {
            return new BridgeResponse
            {
                Id = id,
                Type = type,
                Payload = payload,
                Success = true,
                Error = null
            };
        }

        public static BridgeResponse Fail(string id, string type, string error)
        {
            return new BridgeResponse
            {
                Id = id,
                Type = type,
                Payload = null,
                Success = false,
                Error = error
            };
        }
    }
}
