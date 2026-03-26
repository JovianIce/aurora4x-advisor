# Save Method Mapping

Aurora's GameState has ~88 obfuscated methods that each take a single `SQLiteConnection`
parameter. These are Aurora's built-in serialization routines. The DatabaseManager calls
them to populate an in-memory SQLite database with live game data.

## Version-specific

**The method names are obfuscated and change with every Aurora build.** The mapping below
is for checksum `OdxONo` (current development target). The mapping is keyed by Aurora.exe
checksum in `Lib/DatabaseManager.cs` (`VersionedMappings` dictionary).

For **unknown Aurora versions**, the system automatically falls back to trigger-based
discovery (slower first query, but works for any version). To add a hardcoded mapping
for a new version:

1. Launch Aurora with the new version, connect the Electron app
2. Run `await window.api.bridge.rediscoverMapping()` in devtools
3. Copy the output into a new checksum block in `VersionedMappings`

This mapping was discovered using SQLite INSERT/UPDATE/DELETE triggers, running each method
individually against a populated in-memory database.

## How selective save works

1. Client sends a SQL query (e.g. `SELECT * FROM FCT_Fleet JOIN FCT_Ship ...`)
2. Bridge extracts all `FCT_*` table names from the SQL
3. Looks up which save methods write to those tables
4. Calls **only** those methods (e.g. 2 instead of 88) on the UI thread
5. Executes the query against the refreshed in-memory DB

Tables are marked stale on each game tick. If a table was already refreshed since the
last tick, the save is skipped entirely.

## Mapped methods (66 methods, write to tables)

### Research
| Method | Tables |
|--------|--------|
| `kc` | FCT_ResearchProject |
| `kk` | FCT_RaceTech |
| `km` | FCT_TechSystem |
| `i2` | FCT_TechProgressionRace |
| `k0` | FCT_DesignPhilosophy, FCT_DesignPhilosophyTechProgressionCategories |

### Fleets & Orders
| Method | Tables |
|--------|--------|
| `jh` | FCT_Fleet, FCT_FleetHistory, FCT_FleetStandingOrder, FCT_FleetConditionalOrder |
| `jf` | FCT_SubFleets |
| `i9` | FCT_MoveOrders |
| `ja` | FCT_MoveOrderTemplate |
| `jg` | FCT_StandingOrderTemplate, FCT_StandingOrderTemplateOrder |
| `iz` | FCT_OrderTemplate |
| `ip` | FCT_Squadron |

### Ships & Classes
| Method | Tables |
|--------|--------|
| `js` | FCT_Ship, FCT_ShipWeapon, FCT_DamagedComponent, FCT_ShipHistory, FCT_WeaponAssignment, FCT_DecoyAssignment, FCT_FireControlAssignment, FCT_MissileAssignment, FCT_ArmourDamage, FCT_ShipMeasurement |
| `jj` | FCT_ShipCargo |
| `jz` | FCT_DamageControlQueue |
| `jm` | FCT_ShipClass, FCT_ClassMaterials, FCT_ClassOrdnanceTemplate, FCT_ClassComponent, FCT_ClassSC, FCT_ClassGroundTemplates |
| `kn` | FCT_ShipDesignComponents |
| `kp` | FCT_ShipComponentTemplate |
| `jx` | FCT_MissileType |
| `j0` | FCT_HullDescription |

### Systems & Stars
| Method | Tables |
|--------|--------|
| `im` | FCT_System |
| `ix` | FCT_Star |
| `iy` | FCT_JumpPoint |
| `i5` | FCT_LagrangePoint |
| `jn` | FCT_SystemBodyName |
| `jy` | FCT_AtmosphericGas |

### Minerals & Economy
| Method | Tables |
|--------|--------|
| `jl` | FCT_MineralDeposit |
| `j5` | FCT_WealthData |
| `j6` | FCT_RaceMineralData |
| `i6` | FCT_PopTradeBalance |
| `i4` | FCT_MassDriverPackets |

### Population & Industry
| Method | Tables |
|--------|--------|
| `jk` | FCT_Population, FCT_PopulationWeapon, FCT_PopComponent, FCT_PopMDChanges |
| `ji` | FCT_PopulationInstallations |
| `jv` | FCT_IndustrialProjects |
| `j2` | FCT_Shipyard |

### Commanders
| Method | Tables |
|--------|--------|
| `j1` | FCT_Commander, FCT_CommanderHistory, FCT_CommanderMedal, FCT_CommanderMeasurement, FCT_CommanderBonuses, FCT_CommanderTraits |

### Race & Game
| Method | Tables |
|--------|--------|
| `a5` | FCT_Game |
| `a6` | FCT_Race, FCT_KnownRuinRace, FCT_RaceNameThemes, FCT_WindowPosition, FCT_GroundUnitSeries, FCT_GroundUnitSeriesClass, FCT_RaceOperationalGroupElements, FCT_HullNumber, FCT_WealthHistory |
| `j4` | FCT_Species, FCT_KnownSpecies |

### Surveys
| Method | Tables |
|--------|--------|
| `kz` | FCT_RaceSysSurvey, FCT_RaceJumpPointSurvey |
| `iw` | FCT_SurveyLocation, FCT_RaceSurveyLocation |

### Ground Units
| Method | Tables |
|--------|--------|
| `ir` | FCT_GroundUnitFormationElement, FCT_GroundUnitFormationElementTemplates, FCT_STODetected |
| `is` | FCT_GroundUnitFormationTemplate |
| `it` | FCT_GroundUnitFormation |
| `iu` | FCT_GroundUnitClass, FCT_GroundUnitCapability |

### Aliens
| Method | Tables |
|--------|--------|
| `ke` | FCT_AlienRace, FCT_AlienRaceSpecies, FCT_AlienSystem |
| `kf` | FCT_AlienClass, FCT_AlienClassSensor, FCT_AlienClassWeapon, FCT_AlienClassTech |
| `kg` | FCT_AlienRaceSensor |
| `kh` | FCT_AlienShip |
| `ki` | FCT_AlienGroundUnitClass |
| `kj` | FCT_AlienPopulation |

### Misc
| Method | Tables |
|--------|--------|
| `kd` | FCT_SectorCommand |
| `ko` | FCT_Increments |
| `ks` | FCT_GameLog |
| `kt` | FCT_EventColour |
| `kw` | FCT_OrganizationNode |
| `kx` | FCT_Ranks |
| `ky` | FCT_HideEvents |
| `iq` | FCT_WindowPosition |
| `in` | FCT_RaceMedals |
| `io` | FCT_MedalConditionAssignment |
| `jp` | FCT_AncientConstruct |
| `jr` | FCT_RuinRace |
| `ju` | FCT_Wrecks, FCT_WreckTech, FCT_WreckComponents |
| `j8` | FCT_NavalAdminCommand |

## Unmapped methods (22 methods, no tables detected)

These methods produced no INSERT, UPDATE, or DELETE triggers during testing.
They may activate during specific game states (combat, diplomacy, etc.) or
may be unused/dead code.

| Method | Notes |
|--------|-------|
| `kb` | Unknown - no writes detected |
| `kl` | Unknown - no writes detected |
| `kq` | Unknown - no writes detected |
| `kr` | Unknown - no writes detected |
| `ku` | Unknown - no writes detected |
| `kv` | Unknown - no writes detected |
| `iv` | Unknown - no writes detected |
| `i0` | Unknown - no writes detected |
| `i1` | Unknown - no writes detected |
| `i3` | Unknown - no writes detected |
| `i7` | Unknown - no writes detected |
| `i8` | Unknown - no writes detected |
| `jb` | Unknown - no writes detected |
| `jc` | Unknown - no writes detected |
| `jd` | Unknown - no writes detected |
| `je` | Unknown - no writes detected |
| `jo` | Unknown - no writes detected |
| `jq` | Unknown - no writes detected |
| `jt` | Unknown - no writes detected |
| `jw` | Unknown - no writes detected |
| `j3` | Unknown - no writes detected |
| `j7` | Unknown - no writes detected |
| `j9` | Unknown - no writes detected |
| `ka` | Unknown - no writes detected |

To investigate these, try `rediscoverMapping` after triggering different game events
(combat, first contact, ground invasions, etc.) and compare the output.

## Tables with no save method

These tables exist in the Aurora schema but are not populated by any save method.
Data for these only comes from the on-disk AuroraDB.db or from the MemoryReader.

- **FCT_SystemBody** - use MemoryReader (`getbodies` endpoint) instead
- Various lookup/reference tables populated at game creation time

## Re-discovery

To verify or update this mapping, use the bridge diagnostic endpoint:

```js
// In Electron devtools console:
const result = await window.api.bridge.rediscoverMapping()
console.log(JSON.stringify(result, null, 2))
```

This runs all save methods with SQLite triggers active to detect INSERT/UPDATE/DELETE
on every table. Takes ~30-60 seconds as it freezes Aurora's UI during the process.
