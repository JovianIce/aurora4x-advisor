# AuroraPatch

This allows patching of the Aurora executable, it supports Harmony. The patcher works with any Aurora version.

## For users

Grab the latest zip from the [releases page](https://github.com/Aurora-Modders/AuroraPatch/releases). Extract AuroraPatch.zip in Aurora's folder. Patches go into their own `\Patches\{name}\` subfolder where `name` is the name of the patch. Start the game by running AuroraPatch.exe.

## For patch creators

Your patch should be a Class Library targeting the .Net 4 Framework (same as Aurora itself). You create a patch by extending the `AuroraPatch.Patch` class. See the Example project.

When working on a patch, there may be patch-specific instructions on how to build/contribute to the project.

Otherwise, please see the [PATCH_CONTRIBUTORS.md](/PATCH_CONTRIBUTORS.md) file for help on how to get up and running.

### Lib

The Lib patch is a patch intended to provide services to other patches, a bit like HugsLib in RimWorld modding. In particular it attempts to provide methods for patch authors to interact with Aurora which are robust to Aurora's ever-changing code obfuscation. Patch creators are encouraged to add any deobfuscation knowledge they uncover to Lib's KnowledgeBase to make it available to other patchers, thereby minimizing the instances where patch creators have to do the same deobfuscation work twice.

### AdvisorBridge

WebSocket bridge that runs inside Aurora's process, serving live game data to the Electron frontend.

**Architecture:**
- `BridgeServer.cs` - WebSocket message router (Fleck), tick detection via TacticalMap.TextChanged
- `Providers/` - Domain-specific data providers (SQL + real-time memory reader)
- `MemoryReader.cs` - Reads game objects directly from memory via cached reflection

**Data access modes:**
1. **Memory reader** (real-time) - reads live GameState objects via reflection. No UI thread blocking. Used for fleets, ships, systems, stars, bodies.
2. **SQL** (selective save) - refreshes only the save methods that write to the queried tables. The `query` endpoint auto-detects `FCT_*` table names in the SQL and selectively refreshes them.

See [SAVE_METHOD_MAPPING.md](SAVE_METHOD_MAPPING.md) for the complete mapping of obfuscated save methods to SQL tables.

**Building:**
```
build-deploy.bat [Debug|Release]
```

## For contributors

AuroraPatch is the main patcher application, it takes over and runs the Aurora game itself. AuroraPatch is designed to be as robust as possible against Aurora updates, any code which may stop working when Aurora updates belongs in Lib and not in AuroraPatch.
