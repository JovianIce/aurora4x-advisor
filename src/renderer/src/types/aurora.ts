export interface MemorySystemBody {
  SystemBodyID: number
  SystemID: number
  StarID: number
  PlanetNumber: number
  OrbitNumber: number
  ParentBodyID: number
  ParentBodyType: number
  BodyClass: string
  Name: string
  OrbitalDistance: number
  Bearing: number
  Density: number
  Radius: number
  Gravity: number
  Mass: number
  EscapeVelocity: number
  Xcor: number
  Ycor: number
  BaseTemp: number
  SurfaceTemp: number
  Year: number
  TidalForce: number
  DayValue: number
  Eccentricity: number
  EccentricityDirection: number
  AtmosPress: number
  Albedo: number
  GHFactor: number
  TidalLock: boolean
  DistanceToOrbitCentre: number
  DistanceToParent: number
  CurrentOrbitalSpeed: number
  MeanOrbitalSpeed: number
  HydroType: string
  TectonicActivity: string
  Roche: number
  MagneticField: number
  Ring: number
  DominantTerrain: number
  AGHFactor: number
  FixedBody: boolean
  FixedBodyParentID: number
}

export interface MemoryFleet {
  FleetID: number
  FleetName: string
  Speed: number
  Xcor: number
  Ycor: number
  RaceID: number
  ShipCount: number
  SystemID: number
  SystemName: string
  IsCivilian: boolean
}
