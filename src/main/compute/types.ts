/**
 * Shared types for the compute layer.
 * All compute functions take a QueryFn and return structured results.
 */

// The universal query interface -compute functions receive this instead of a DB/bridge import
export type QueryFn = <T = Record<string, unknown>>(sql: string) => Promise<T[]>

// Game context -resolved from current game session, passed to all compute functions
export interface GameCtx {
  gameId: number
  raceId: number
}

// --- Route Types ---

export interface RouteWaypoint {
  systemId: number
  systemName: string
  x?: number
  y?: number
  label?: string
}

export interface GeometryLeg {
  from: { systemId: number; systemName: string }
  to: { systemId: number; systemName: string }
  type: 'in-system' | 'jump'
  distanceKm: number
  travelSeconds: number
  travelDays: number
}

export interface RouteLeg extends GeometryLeg {
  fuelBurn: number
}

export interface RouteResult {
  legs: RouteLeg[]
  totalDistanceKm: number
  totalTravelDays: number
  totalFuelBurn: number
  fuelCapacity: number
  fuelRemaining: number
  sufficient: boolean
  speed: number
  className: string
}

export interface RouteRequest {
  classId: number
  startSystemId: number
  startX?: number
  startY?: number
  endSystemId: number
  endX?: number
  endY?: number
  waypointSystemIds?: number[]
}

// --- Fleet Route Types ---

export interface FleetRouteWaypoint {
  systemId: number
  refuel?: boolean
}

export interface FleetRouteRequest {
  fleetId: number
  endSystemId: number
  waypoints?: FleetRouteWaypoint[]
}

export interface ShipFuelLeg {
  shipId: number
  name: string
  className: string
  burnRate: number
  fuelBurn: number
  fuelRemaining: number
  fuelPct: number
  sufficient: boolean
}

export interface FleetRouteLeg extends GeometryLeg {
  shipFuel: ShipFuelLeg[]
  refuelStop: boolean
}

export interface FleetRouteResult {
  fleetName: string
  fleetSpeed: number
  speedLimitedBy: string
  legs: FleetRouteLeg[]
  totalDistanceKm: number
  totalTravelDays: number
  bottleneck: {
    shipId: number
    name: string
    className: string
    runsOutOnLeg: number
    shortfall: number
  } | null
  tankerInFleet: {
    shipId: number
    name: string
    fuelCapacity: number
    fuelRemaining: number
  } | null
}

// --- Fleet List Types ---

export interface FleetShip {
  shipId: number
  shipName: string
  className: string
  classId: number
  fuel: number
  fuelCapacity: number
  maxSpeed: number
  enginePower: number
  fuelEfficiency: number
  tonnage: number
  isTanker: boolean
  jumpCapable: boolean
  jumpDriveInfo: { name: string; type: string; maxTonnage: number; squadMax: number; radius: number } | null
  isMilitary: boolean
  isCommercial: boolean
}

export interface JumpAnalysis {
  allJumpCapable: boolean
  shipsWithoutJD: { shipName: string; className: string; isMilitary: boolean; isCommercial: boolean }[]
  milTender: { shipName: string; className: string; maxTonnage: number; squadMax: number } | null
  commTender: { shipName: string; className: string; maxTonnage: number; squadMax: number } | null
  uncoveredShips: { shipName: string; className: string; reason: string }[]
  squadCapWarning: string | null // e.g. "6 mil ships need jump, tender supports 4 per jump"
  status: 'ok' | 'covered' | 'warning'
}

export interface Fleet {
  fleetId: number
  fleetName: string
  systemId: number
  systemName: string
  speed: number
  x: number
  y: number
  ships: FleetShip[]
  jumpAnalysis: JumpAnalysis
}

// --- Ship Types ---

export interface Ship {
  shipId: number
  shipClassId: number
  name: string
  className: string
  fleet: string
  system: string
  systemId: number
  speed: number
  fuel: number
  fuelCapacity: number
  fuelPct: number | null
  rangeDays: number | null
  commercial: boolean
  military: boolean
  fighter: boolean
  tanker: boolean
  freighter: boolean
  deploymentRemaining: number | null
  monthsSinceOverhaul: number
  maintenanceState: number
  jumpsToSol: number | null
  travelDaysToSol: number | null
  nearestTanker: {
    shipId: number
    name: string
    fuel: number
    sameSystem: boolean
    jumps: number
  } | null
}

// --- Mineral Types ---

export type Resolution = 'raw' | 'monthly' | 'quarterly' | 'annual'

export interface ColonyMinerals {
  populationId: number
  name: string
  system: string
  minerals: Record<string, number>
}

export interface MineralTotalsResult {
  totals: Record<string, number>
  byColony: ColonyMinerals[]
}

export interface HistoryPoint {
  time: number
  gameDate: string
  minerals: Record<string, number>
}

export interface MineralHistoryResult {
  resolution: Resolution
  populationId: number | null
  series: HistoryPoint[]
}

export interface BreakdownPoint {
  time: number
  gameDate: string
  income: Record<string, number>
  expense: Record<string, number>
  net: number
}

export interface MineralBreakdownResult {
  mineralId: number
  mineralName: string
  resolution: Resolution
  series: BreakdownPoint[]
}

export interface MineralColony {
  populationId: number
  name: string
  system: string
}

// --- Ship Class Types ---

export interface ShipClassSummary {
  ShipClassID: number
  ClassName: string
  MaxSpeed: number
  FuelCapacity: number
  EnginePower: number
  FuelEfficiency: number
  Tonnage: number
  Commercial: boolean
  MilitaryEngines: boolean
  FighterClass: boolean
  JumpDistance: number
}

export interface ShipClassData {
  ShipClassID: number
  ClassName: string
  RaceID: number
  Tonnage: number
  MaxSpeed: number
  FuelCapacity: number
  Crew: number
  PlannedDeployment: number
  CargoCapacity: number
  MagazineCapacity: number
  JumpDistance: number
  BuildPointCost: number
  Commercial: boolean
  FighterClass: boolean
  MilitaryEngines: boolean
  EnginePower: number
  FuelEfficiency: number
  ShieldStrength: number
  ArmourThickness: number
  ArmourWidth: number
  ActiveSensorStrength: number
  PassiveSensorStrength: number
  EMSensorStrength: number
  ReactorPower: number
  STSTractor: number
  GravSurvey: number
  GeoSurvey: number
  DCRating: number
  ControlRating: number
  MaintSupplies: number
  Locked: boolean
}

export interface ClassComponent {
  NumComponent: number
  Name: string
  Tons: number
  HTK: number
  CompCrew: number
  Weapon: boolean
  MilitarySystem: boolean
}

export interface ShipClassDetail {
  class: ShipClassData
  components: ClassComponent[]
}

// --- Game Date ---

export interface GameDate {
  gameTime: number
  startYear: number
  year: number
  month: number
  day: number
  hours: number
  minutes: number
  seconds: number
  formatted: string
}
