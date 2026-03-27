import { useQuery, useMutation } from '@tanstack/react-query'

// Re-export compute types for renderer use
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

export interface RouteLeg {
  from: { systemId: number; systemName: string }
  to: { systemId: number; systemName: string }
  type: 'in-system' | 'jump'
  distanceKm: number
  travelDays: number
  fuelBurn: number
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

export interface FleetRouteLeg {
  from: { systemId: number; systemName: string }
  to: { systemId: number; systemName: string }
  type: 'in-system' | 'jump'
  distanceKm: number
  travelDays: number
  shipFuel: ShipFuelLeg[]
  refuelStop: boolean
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
  shipsWithoutJD: { shipName: string; className: string }[]
  milTender: { shipName: string; className: string; maxTonnage: number; squadMax: number } | null
  commTender: { shipName: string; className: string; maxTonnage: number; squadMax: number } | null
  uncoveredShips: { shipName: string; className: string; reason: string }[]
  squadCapWarning: string | null
  status: 'ok' | 'covered' | 'warning'
}

export interface Waypoint {
  systemId: number
  systemName: string
  x?: number
  y?: number
  label: string
}

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

export interface ColonyMinerals {
  populationId: number
  name: string
  system: string
  minerals: Record<string, number>
}

export interface MineralColony {
  populationId: number
  name: string
  system: string
}

export interface MineralBreakdownResponse {
  mineralId: number
  mineralName: string
  resolution: string
  series: {
    time: number
    gameDate: string
    income: Record<string, number>
    expense: Record<string, number>
    net: number
  }[]
}

// --- Hooks ---

export function useShips(enabled = true) {
  return useQuery({
    queryKey: ['ops', 'ships'],
    queryFn: () => window.api.ops.getShips() as Promise<{ ships: Ship[]; gameTime: number }>,
    staleTime: 30_000,
    refetchInterval: enabled ? 30_000 : false,
    enabled
  })
}

export function useClasses(enabled = true) {
  return useQuery({
    queryKey: ['ops', 'classes'],
    queryFn: () => window.api.ops.getClasses() as Promise<ShipClassSummary[]>,
    staleTime: 60_000,
    enabled
  })
}

export function useClassDetail(classId: number | null) {
  return useQuery({
    queryKey: ['ops', 'classDetail', classId],
    queryFn: () =>
      window.api.ops.getClassDetail(classId!) as Promise<{
        class: ShipClassData
        components: ClassComponent[]
      }>,
    enabled: classId != null && classId > 0,
    staleTime: 120_000
  })
}

export function useWaypoints(enabled = true) {
  return useQuery({
    queryKey: ['ops', 'waypoints'],
    queryFn: () => window.api.ops.getWaypoints() as Promise<Waypoint[]>,
    staleTime: 60_000,
    enabled
  })
}

export function useComputedFleets(enabled = true) {
  return useQuery({
    queryKey: ['ops', 'fleets'],
    queryFn: () => window.api.ops.getFleets() as Promise<Fleet[]>,
    staleTime: 30_000,
    enabled
  })
}

export function useComputedGameDate(enabled = true) {
  return useQuery({
    queryKey: ['ops', 'gameDate'],
    queryFn: () => window.api.ops.getGameDate() as Promise<GameDate | null>,
    staleTime: 30_000,
    enabled
  })
}

export function useMineralTotals(enabled = true) {
  return useQuery({
    queryKey: ['ops', 'mineralTotals'],
    queryFn: () =>
      window.api.ops.getMineralTotals() as Promise<{
        totals: Record<string, number>
        byColony: ColonyMinerals[]
      }>,
    staleTime: 30_000,
    enabled
  })
}

export function useMineralHistory(resolution: string, populationId: number | null, enabled = true) {
  return useQuery({
    queryKey: ['ops', 'mineralHistory', resolution, populationId],
    queryFn: () =>
      window.api.ops.getMineralHistory(resolution, populationId) as Promise<{
        resolution: string
        populationId: number | null
        series: { time: number; gameDate: string; minerals: Record<string, number> }[]
      }>,
    staleTime: 30_000,
    enabled
  })
}

export function useMineralBreakdown(mineralId: number | null, resolution: string, enabled = true) {
  return useQuery({
    queryKey: ['ops', 'mineralBreakdown', mineralId, resolution],
    queryFn: () =>
      window.api.ops.getMineralBreakdown(mineralId!, resolution) as Promise<MineralBreakdownResponse>,
    enabled: enabled && mineralId != null && mineralId > 0,
    staleTime: 30_000
  })
}

export function useMineralColonies(enabled = true) {
  return useQuery({
    queryKey: ['ops', 'mineralColonies'],
    queryFn: () => window.api.ops.getMineralColonies() as Promise<MineralColony[]>,
    staleTime: 60_000,
    enabled
  })
}

export function useResearchOverview(enabled = true) {
  return useQuery({
    queryKey: ['ops', 'researchOverview'],
    queryFn: () =>
      window.api.ops.getResearchOverview() as Promise<ResearchOverview>,
    staleTime: 300_000,
    enabled
  })
}

export function useComputeRoute() {
  return useMutation({
    mutationFn: (req: unknown) => window.api.ops.computeRoute(req) as Promise<RouteResult>
  })
}

export function useComputeFleetRoute() {
  return useMutation({
    mutationFn: (req: unknown) =>
      window.api.ops.computeFleetRoute(req) as Promise<FleetRouteResult>
  })
}

// --- Research Types ---

export interface TechNode {
  id: number
  name: string
  fieldId: number
  fieldName: string
  cost: number
  prerequisite1: number
  prerequisite2: number
  description: string
  researched: boolean
  researchable: boolean
  raceDesigned: boolean
  isStarting: boolean
  completedTime: number | null
  completedDate: string | null
}

export interface ResearchProject {
  projectId: number
  techName: string
  fieldId: number
  fieldName: string
  totalCost: number
  labs: number
  pointsRemaining: number
  percentComplete: number
  paused: boolean
  colony: string
}

export interface TechCategory {
  id: number
  name: string
  total: number
  researched: number
}

export interface ResearchOverview {
  techs: TechNode[]
  projects: ResearchProject[]
  categories: TechCategory[]
}

