using System;
using System.Collections.Generic;
using System.Data;
using HarmonyLib;

namespace AdvisorBridge
{
    /// <summary>
    /// Patch entry point that starts the WebSocket bridge server inside Aurora's process.
    /// Depends on the Lib patch for type resolution, database access, and UI management.
    ///
    /// Lifecycle:
    ///   Loaded() - called when Aurora.exe assembly is loaded (before TacticalMap exists)
    ///   Started() - called after TacticalMap is shown; starts the bridge server on port 47842
    /// </summary>
    public class AdvisorBridge : AuroraPatch.Patch
    {
        public override string Description => "WebSocket bridge for Aurora4X Advisor frontend";
        public override IEnumerable<string> Dependencies => new[] { "Lib" };

        private BridgeServer Server;

        protected override void Loaded(Harmony harmony)
        {
            LogInfo("AdvisorBridge loaded");
        }

        protected override void Started()
        {
            var lib = GetDependency<Lib.Lib>("Lib");

            Server = new BridgeServer(lib.DatabaseManager, this, lib);
            Server.Start(47842);

            LogInfo("AdvisorBridge started - WebSocket server running on port 47842");
        }
    }
}
