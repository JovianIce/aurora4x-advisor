# Roadmap

## Current State

**Working:**

- 2D system map (orbital rendering, stars, planets, moons, fleets, orbits, zoom/pan, real-time push updates)
- Body list panel (hierarchical tree sidebar)
- Display filters (toggle body types, orbits, names, fleets)
- Advisor persona system (8 archetypes, ideology matching, greetings/observations)
- Form toolbar (opens visible Aurora forms)
- Memory explorer + table explorer (dev tools)
- Bridge infrastructure (WebSocket, MemoryReader, ActionExecutor)

**Known issues:**

- **Advisor uses mock data.** Built with legacy code before real-time memory reading existed. Needs to be rewired to use live bridge data instead of fake snapshots.
- **App flow is messy.** The setup/dashboard/config flow was cobbled together incrementally and doesn't feel like a cohesive app. Needs a UX pass to make it intuitive.
- **Must open after Aurora.** The app can't connect to the bridge if Aurora isn't already running. Need graceful reconnection — let users open the app first and auto-connect when Aurora launches.

---

## Phase 0: Fix Foundations

Before building new features, clean up what's already there.

| Issue | Description |
| --- | --- |
| Advisor → live data | Replace mock `queryGameState` and snapshot-based analysis with real-time data from the bridge |
| App flow rework | Rethink the welcome → setup → dashboard → config flow into something coherent |
| Bridge reconnection | Handle app-opened-before-Aurora gracefully — retry connection, show status, auto-connect when bridge appears |

---

## Phase 1: Complete the Tactical Map

The map renders data but isn't interactive yet. This is the foundation everything else builds on.

| Feature | Description | Effort |
| --- | --- | --- |
| Hit-testing + selection | Click bodies/fleets on canvas, pulsing selection ring, sync with body list sidebar | Medium |
| Hover tooltips | HTML overlay with quick stats (name, type, gravity, temp for bodies; name, ships, speed for fleets) | Low |
| Context menus | Right-click: "View in Aurora" (opens form), copy coordinates, center map | Low |
| Body detail panel | Slide-in panel: full planet data (atmosphere, temperature, gravity, mass, hydro, tectonics, minerals) | Medium |
| Fleet detail panel | Ship list, speed, destination, race, civilian status | Medium |
| Galaxy map | All star systems as nodes, jump point connections, click-to-navigate between systems | High |
| 3D system view | Three.js orrery with procedural planet rendering from Aurora data (body type, temp, atmosphere, hydro) | Very High |

---

## Phase 2: Game Section Tools

Analysis and management tools for each area of the game. Some of these will be integrations of existing community tools rather than built from scratch.

| Area | Description | Notes |
| --- | --- | --- |
| Economy | Colony stats, mineral stockpiles, fuel reserves, production queues | |
| Fleet management | Ship class viewer, fleet composition, maintenance status | Ship class data: 182 classes, 127 fields |
| Research | Tech tree viewer, current research progress, advisor recommendations | |
| Mineral survey | Overlay bodies by mineral richness on tactical map, sortable survey table | |
| Diplomacy | Race relations, contact status, treaty tracking | |
| Ground forces | Army composition, transport capacity, garrison status | |
| Event timeline | Game log reader (130K+ entries), category filtering, push notifications for new events | Paginated, newest first |
| Threat assessment | Foreign fleet identification, system-level threat indicators | |
| Shipyard status | Idle/building, queue management, capacity overview | |

---

## Phase 3: Community & Integration

| Feature | Description |
| --- | --- |
| Community tool integration | Embed or link existing Aurora community tools where they already solve the problem |
| Save statistics export | Empire stats as JSON/CSV |
| Snapshot comparison | Diff empire state between two points in time |
| Discord webhooks | Push game events (alien contact, combat, milestones) to a Discord channel |

---

## Technical Notes

**Data access patterns:**

- Real-time rendering (bodies, fleets, stars): MemoryReader push on game tick
- Reference data (systems, races, classes): MemoryReader on-demand
- Complex data (game log, tech, diplomacy): Generic `readCollection` with field discovery
- SQL queries: In-memory DB mirror — use sparingly

**Performance:**

- SystemBody (3539 items) read every tick — already optimized with fast-read field subset
- GameLog (130K+ entries) — must paginate, never read all at once
- 3D rendering should be a separate canvas to avoid blocking 2D tactical map

**Version risk:**

- Aurora updates change obfuscated names. New versions need re-running the Example patch F12 inspector.
- SignatureManager + KnowledgeBase handle version detection via SHA256 checksum.
