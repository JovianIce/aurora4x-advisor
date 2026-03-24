# Aurora 4X Advisor

A tactical companion and visualization tool for [Aurora 4X](http://aurorawiki.pentarch.org/). Connects to a running Aurora instance via a C# Harmony patch, providing real-time system maps, fleet overlays, context-aware data panels, and an advisor persona system — all while Aurora remains your primary interface.

> **Status:** Actively developed. The Electron companion app, C# bridge, and real-time memory reader are functional. Advisor persona system is implemented. Dashboard with tactical map viewer, data explorer, and memory inspector are in progress.

## Important Note

This project is a **companion tool**, not a replacement client. Aurora 4X must remain visible, usable, and the primary game interface. This tool assists, enhances, and accelerates your interaction with Aurora — it does not replace it. This distinction is important and reflects the wishes of Aurora's creator, Steve Walmsley.

## How It Works

Aurora 4X is a closed-source .NET WinForms application with obfuscated type names. This project works around that:

1. **AuroraPatch** loads as a launcher, applies [Harmony](https://github.com/pardeike/Harmony) patches to Aurora.exe at runtime
2. **AdvisorBridge** (a patch plugin) starts a WebSocket server inside the Aurora process on `ws://localhost:47842`
3. **MemoryReader** uses cached reflection to read game objects (stars, planets, fleets, ships) directly from Aurora's live memory
4. **The Electron app** connects to the bridge, reads game state, and renders companion visualizations alongside Aurora

> **Note on AuroraPatch:** The `AuroraPatch-master/` directory is a **modified fork** of the original [AuroraPatch](https://github.com/Aurora-Modders/AuroraPatch) project. The **Lib** library has been significantly extended with new components (`DatabaseManager`, `SignatureManager`, `KnowledgeBase`, `UIManager`) that provide the infrastructure AdvisorBridge depends on. **AdvisorBridge** is the new project added by this repo. The **Automation** project is from the original AuroraPatch and kept as a reference example of the patching API. The **Example** project originated from AuroraPatch but has been heavily modified into a dev tool for discovering Aurora's obfuscated types and field mappings (F12 inspector, type candidate search, GameState collection dumping). The core AuroraPatch launcher and `Patch` base class remain largely unchanged.

```
┌──────────────────────────────────────────────────────┐
│        Companion App (Electron + React + TS)         │
│                                                      │
│  Tactical Map ─ Fleet Overlay ─ Advisor ─ Analytics  │
└──────────────────┬───────────────────────────────────┘
                   │  WebSocket (ws://localhost:47842)
┌──────────────────┴───────────────────────────────────┐
│           AdvisorBridge (C# Harmony Patch)           │
│                                                      │
│  BridgeServer ─ MemoryReader ─ ActionExecutor        │
│       │              │               │               │
│   SQL queries   Live game state   UI automation      │
│   via in-memory   via reflection   (triggers visible │
│   SQLite mirror                    Aurora actions)   │
└──────────────────────────────────────────────────────┘
                   │  Harmony patches
┌──────────────────────────────────────────────────────┐
│        Aurora 4X (primary interface, always visible) │
└──────────────────────────────────────────────────────┘
```

### Data Pipeline

Aurora's types and fields are obfuscated (e.g., type `kc` = SystemBody, field `v` = SystemBodyID). The conversion from raw memory to usable data is split across both sides:

- **C# Bridge (MemoryReader):** Reads obfuscated fields from Aurora's live objects via cached reflection, and maps them to human-readable keys before sending (`SystemBodyID`, `FleetName`, `OrbitalDistance`, etc.). Each entity type has a static `XxxFieldNameMap` dictionary in `MemoryReader.cs` that defines the obfuscated-to-readable mapping (e.g., `"v"` -> `"SystemBodyID"` for bodies, `"f"` -> `"StarID"` for stars). A shared `BuildFastFields` / `ReadMappedFields` pattern handles all types consistently.
- **Electron App:** Receives JSON with readable keys over WebSocket and renders directly — no client-side field translation needed.

## Features

### Real-Time Tactical Map Viewer

- Canvas-based system map with orbital body rendering alongside Aurora's own map
- Fleet position overlays with movement tracking

### Context-Aware Data Panels

- Fleet, planet, and system intel panels that update in real-time
- Data explorer for querying Aurora's game state without digging through menus
- Memory inspector for advanced users exploring game internals

### Advisor Personas

- 8 built-in advisor archetypes (Nationalist, Technocrat, Communist, Monarchist, Military, Corporate, Diplomatic, Religious)
- Each shaped by Aurora's ideology stats (Xenophobia, Diplomacy, Militancy, Expansionism, etc.)
- Context-aware guidance and observation messages that match the advisor's personality
- Tutorial system that adapts to your empire's development stage

### Game Bridge

- WebSocket server embedded in the Aurora process via Harmony patching
- Direct memory reads of game objects (systems, bodies, stars, fleets, ships) — no file polling
- In-memory SQLite mirror of Aurora's database, refreshed on demand (the refresh invokes Aurora's save routines on the UI thread, which can lag — so it only runs when explicitly requested, not on a timer)
- Push notifications on game tick (time advancement) for subscribed systems
- Quick commands that trigger visible Aurora UI actions (opening forms, clicking toolbar buttons)

## Project Structure

```
aurora4x-advisor/
├── src/                          # Electron + React companion app
│   ├── main/                     # Electron main process
│   │   ├── advisor/              # Advisor persona system
│   │   ├── services/             # Bridge client, DB watcher, game detection
│   │   └── index.ts              # IPC handlers
│   ├── renderer/src/             # React frontend
│   │   ├── components/           # UI components (dashboard, system map, etc.)
│   │   ├── contexts/             # React contexts (game state, aurora data)
│   │   └── hooks/                # Custom hooks
│   ├── preload/                  # Electron IPC bridge
│   └── shared/                   # Shared TypeScript types
├── AuroraPatch-master/           # C# codebase (.NET Framework 4.8)
│   ├── AuroraPatch/              # Harmony patch loader and launcher
│   ├── Lib/                      # Core library (type resolution, DB, UI helpers)
│   ├── AdvisorBridge/            # WebSocket bridge plugin
│   ├── Automation/               # Example automation patch
│   └── Example/                  # Dev tool for discovering Aurora's obfuscated types
└── resources/config/             # Advisor personality profiles (JSON)
```

## Getting Started (User)

If you just want to **use** the tool with your Aurora installation:

### Prerequisites

- **Aurora 4X** C# version installed
- **Node.js 18+** with pnpm (for the companion app)

### Setup

1. Download the latest release of the C# bridge
2. Place `AuroraPatch.exe`, `0Harmony.dll`, and other root-level dependencies into your Aurora 4X installation directory (next to `Aurora.exe`)
3. Place the `Lib` and `AdvisorBridge` patch folders into the `Patches/` directory
4. Launch Aurora through `AuroraPatch.exe` instead of `Aurora.exe`
5. Start the Electron companion app — it connects to the bridge automatically

```
Your Aurora installation/
├── Aurora.exe                  # The game (untouched)
├── AuroraPatch.exe             # Launches Aurora with patches
├── 0Harmony.dll                # Harmony runtime patching library
├── Newtonsoft.Json.dll          # JSON serialization
├── System.Data.SQLite.dll       # SQLite bindings
├── EntityFramework.dll          # EF for Aurora's DB access
├── AuroraDB.db                 # Aurora's save database
├── Patches/
│   ├── Lib/                    # Core patch library
│   │   ├── Lib.dll
│   │   ├── signatures.json     # Cached type fingerprints
│   │   └── ... (SQLite/EF DLLs)
│   └── AdvisorBridge/
│       └── AdvisorBridge.dll   # WebSocket bridge plugin
└── ... (Aurora's other files)
```

## Getting Started (Developer)

If you want to **build from source** and debug:

### Prerequisites

- **Node.js 18+** with pnpm
- **Visual Studio 2022** (or MSBuild) with .NET Framework 4.8 targeting pack
- **Aurora 4X** C# version installed

### C# Bridge (local dev setup)

Building the AuroraPatch project outputs `AuroraPatch.exe` into `AuroraPatch-master/AuroraPatch/bin/Debug/`. For the patcher to work, that directory needs to be a full Aurora installation — AuroraPatch looks for `Aurora.exe` and loads patches from a `Patches/` subfolder relative to itself.

1. Open `AuroraPatch-master/AuroraPatch.sln` in Visual Studio
2. Copy your entire Aurora 4X installation into `AuroraPatch-master/AuroraPatch/bin/Debug/` (everything — `Aurora.exe`, `AuroraDB.db`, `Flags/`, `Medals/`, etc.)
3. Create `Patches/` subfolders for each patch inside that same directory
4. Build the solution — the AuroraPatch project outputs `AuroraPatch.exe` to `bin/Debug/`, but **each patch project (Lib, AdvisorBridge, etc.) builds to its own `bin/` folder**. You need to copy the built DLLs into the corresponding `Patches/` subfolder in `bin/Debug/`
5. Run/debug `AuroraPatch.exe` from Visual Studio — it launches `Aurora.exe` from the same directory and loads patches from `Patches/`

```
AuroraPatch-master/AuroraPatch/bin/Debug/
├── Aurora.exe                     # Copied from your Aurora installation
├── AuroraDB.db                    # Copied from your Aurora installation
├── AuroraPatch.exe                # Built by the AuroraPatch project
├── AuroraPatch.pdb                # Debug symbols
├── 0Harmony.dll                   # Harmony runtime (build output)
├── Newtonsoft.Json.dll            # JSON lib (build output)
├── System.Data.SQLite.dll         # SQLite bindings (build output)
├── EntityFramework.dll            # EF (build output)
├── Patches/
│   ├── Lib/                       # Copy Lib build output here
│   │   ├── Lib.dll
│   │   ├── signatures.json
│   │   └── ... (SQLite/EF DLLs)
│   ├── AdvisorBridge/             # Copy AdvisorBridge build output here
│   │   └── AdvisorBridge.dll
│   └── Example/                   # Copy Example build output here (optional)
│       └── Example.dll
├── Flags/                         # Copied from Aurora installation
├── Medals/                        # Copied from Aurora installation
└── ... (other Aurora files)
```

> The `bin/` directories are gitignored. Your local Aurora files never enter version control.

### Electron Companion App

```bash
git clone <repository-url>
cd aurora4x-advisor
pnpm install
pnpm dev          # Start in development mode with hot reload
```

## Development Reference

### Electron Commands

| Command          | Description                         |
| ---------------- | ----------------------------------- |
| `pnpm dev`       | Run with hot reload                 |
| `pnpm build`     | Type-check and build for production |
| `pnpm typecheck` | Type-check without building         |
| `pnpm lint`      | Lint with ESLint                    |
| `pnpm format`    | Format with Prettier                |
| `pnpm build:win` | Package for Windows                 |

### WebSocket Protocol

The bridge uses a JSON request/response protocol over WebSocket:

```jsonc
// Request
{ "Id": "req-1", "Type": "getbodies", "Payload": "{\"SystemId\": 21859}" }

// Response
{ "Id": "req-1", "Type": "result", "Success": true, "Payload": [...] }

// Push notification (no Id, sent on game tick)
{ "Id": null, "Type": "push", "Success": true, "Payload": { "pushType": "bodies", "data": {...} } }
```

**Supported message types:**

| Type                   | Description                                                     |
| ---------------------- | --------------------------------------------------------------- |
| `ping`                 | Health check, returns "pong"                                    |
| `query`                | Execute read-only SQL against the in-memory DB mirror           |
| `getsystems`           | All star systems with resolved names                            |
| `getknownsystems`      | Player-known systems (from TacticalMap ComboBox)                |
| `getsystembodies`      | Stars in a system (with StarDetails sub-object)                 |
| `getbodies`            | Planets/moons/asteroids (optimized fast-read fields)            |
| `getfleets`            | All fleets with positions and ship counts                       |
| `getships`             | Ships, optionally filtered by fleet                             |
| `subscribe`            | Subscribe to push updates for a system on each game tick        |
| `enumerategamestate`   | List all fields on the GameState object                         |
| `enumeratecollections` | List all collection-type fields on GameState                    |
| `readcollection`       | Read items from a GameState collection (paginated)              |
| `readfield`            | Read a single field from GameState                              |
| `action`               | Execute a UI action (click button, open form, read/set control) |
| `inspect`              | Inspect all controls on an Aurora form                          |

### Aurora Version Support

Aurora obfuscates its type and field names, which change between versions. The project identifies versions by a SHA256 checksum of `Aurora.exe` (first 6 chars). Currently supported:

| Checksum | Notes                      |
| -------- | -------------------------- |
| `chm1c7` | Older version              |
| `OdxONo` | Current development target |

To add support for a new version:

1. Run the `Example` patch and press F12 in any Aurora form to dump type discovery data
2. Add a new `else if` block in `KnowledgeBase.GetKnownTypeNames()` with the new checksum's type mappings
3. Update field name references in `MemoryReader.cs` if they changed

## Tech Stack

**Companion App:** Electron 39, React 19, TypeScript 5.9, Tailwind CSS 4, Radix UI, TanStack Query, Vite 7

**C# Bridge:** .NET Framework 4.8, Harmony 2.2, System.Data.SQLite, Newtonsoft.Json, EntityFramework 6

## Contributing

Areas where help is needed:

- **Aurora Version Mappings** — Add obfuscated type/field mappings for new Aurora builds
- **Visualizations** — New tactical overlays, analytics views, and data panels
- **Advisor Personas** — Additional personality profiles and observation detectors
- **Testing** — Test with various Aurora save files and game states

## License

Source-available. Free to use, modify, and distribute. One restriction: don't publicly distribute this as a replacement client for Aurora 4X. Private/personal use is unrestricted.

Please respect this. If this boundary is crossed publicly, Steve may add defenses to Aurora that block runtime access to game state entirely — which would kill this project and every other Aurora modding tool with it.

## Acknowledgments

- Steve Walmsley for creating Aurora 4X
- The [AuroraPatch](https://github.com/Aurora-Modders/AuroraPatch) project for the Harmony patching framework
- The Aurora 4X modding community
