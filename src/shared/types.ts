// Shared type definitions for IPC communication between main, preload, and renderer

import { z } from 'zod'

export type ArchetypeId =
  | 'staunch-nationalist'
  | 'technocrat-admin'
  | 'communist-commissar'
  | 'monarchist-advisor'
  | 'military-strategist'
  | 'corporate-executive'
  | 'diplomatic-envoy'
  | 'religious-zealot'

export interface Archetype {
  id: ArchetypeId
  name: string
  description: string
  toneDescriptors: string[]
  vocabularyTags: string[]
}

// Zod schema for ideology validation
export const IdeologyProfileSchema = z.object({
  /** Fear of other races (1-100) */
  xenophobia: z.number().int().min(1).max(100),

  /** Persuasion & negotiation skill (1-100) */
  diplomacy: z.number().int().min(1).max(100),

  /** Use of military force (1-100) */
  militancy: z.number().int().min(1).max(100),

  /** Desire to expand territory (1-100) */
  expansionism: z.number().int().min(1).max(100),

  /** Perseverance despite setbacks (1-100) */
  determination: z.number().int().min(1).max(100),

  /** Willingness to trade (1-100) */
  trade: z.number().int().min(1).max(100)
})

export type IdeologyProfile = z.infer<typeof IdeologyProfileSchema>

export interface MatchResult {
  profileId: string
  profileName: string
  confidence: number
  failedRules: string[]
}

export interface PersonalityMatch {
  archetype: ArchetypeId
  primary: MatchResult
  allMatches: MatchResult[]
}

// Game detection types
export interface GameInfo {
  gameName: string
  auroraGameId: number // GameID from FCT_Game
  auroraRaceId: number // RaceID from FCT_Race (player race)
  startingYear: number
  techLevel: 'TN' | 'Industrial'
  empireName: string
}

// Game state snapshot (captured after initial setup)
export interface GameSnapshot {
  gameYear: number
  hasTNTech: boolean
  alienContact: boolean
  atWar: boolean
  hasBuiltFirstShip: boolean
  hasSurveyedHomeSystem: boolean
  capturedAt: number
}

// Game session types
export interface GameSession {
  id: string
  gameInfo: GameInfo
  personalityArchetype: string | null
  personalityName: string | null
  initialSnapshot?: GameSnapshot // Captured right after setup
  createdAt: number
  lastAccessedAt: number
}

// App settings types
export interface AppSettings {
  auroraDbPath: string | null
  watchEnabled: boolean
  bridgeEnabled: boolean
  bridgePort: number
}

// Aurora Bridge types
export interface BridgeStatus {
  isConnected: boolean
  url: string
  lastError: string | null
}

// Aurora DB schema types for map rendering
export interface SystemBody {
  SystemBodyID: number
  SystemID: number
  Name: string
  OrbitalDistance: number
  Bearing: number
  BodyClass: number
  BodyTypeID: number
  PlanetNumber: number
  OrbitNumber: number
  ParentBodyID: number | null
  Radius: number
  Xcor: number
  Ycor: number
  DistanceToParent: number
  Eccentricity: number
  EccentricityDirection: number
}

export interface StarSystem {
  SystemID: number
  Name: string
  Xcor: number
  Ycor: number
}

// Action execution types
export type ActionType =
  | 'ClickButton'
  | 'OpenForm'
  | 'ReadControl'
  | 'SetControl'
  | 'InspectForm'
  | 'Composite'

export interface ActionRequest {
  Action: ActionType
  /** For ClickButton: AuroraButton enum name. For OpenForm/InspectForm: AuroraType enum name. */
  Target?: string
  /** For ReadControl/SetControl: the AuroraType form name. */
  FormName?: string
  /** For ReadControl/SetControl: the WinForms control name. */
  ControlName?: string
  /** For SetControl: the value to set. */
  Value?: unknown
  /** For Composite: ordered list of sub-actions. */
  Steps?: ActionRequest[]
}

export interface ActionResult {
  Success: boolean
  Error?: string
  Data?: unknown
}

export interface ControlInfo {
  Name: string
  Type: string
  Text: string
  Value?: unknown
  Enabled: boolean
  Visible: boolean
  ParentName: string
  Children?: ControlInfo[]
}

// Fleet/Ship memory types
export interface MemoryFleet {
  FleetID: number
  FleetName: string
  Speed: number
  Xcor: number
  Ycor: number
  RaceID: number
  ShipCount: number
  SystemID: number // 0 if in transit (orbit body)
  SystemName: string // always set from navigation ref
  IsCivilian: boolean
}

export interface MemoryShip {
  ShipID: number
  ShipName: string
  Fuel: number
  FleetID: number
}

// Memory explorer types
export interface GameStateFieldInfo {
  name: string
  type: string
  value?: unknown
  count?: number
  itemFields?: number
  refFields?: number
}

export interface CollectionInfo {
  field: string
  collectionType: 'Dict' | 'List'
  keyType: string | null
  itemType: string
  count: number
  fieldCount: number
  schema: { name: string; type: string }[]
}

export interface ReadCollectionParams {
  Field: string
  Offset?: number
  Limit?: number
  Fields?: string[]
  IncludeRefs?: boolean
  FilterField?: string
  FilterValue?: string
}

/** Known Aurora button names that can be clicked via ActionExecutor */
export type AuroraButton =
  | 'SubPulse'
  | 'SubPulse5S'
  | 'SubPulse30S'
  | 'SubPulse2M'
  | 'SubPulse5M'
  | 'SubPulse20M'
  | 'SubPulse1H'
  | 'SubPulse3H'
  | 'SubPulse8H'
  | 'SubPulse1D'
  | 'SubPulse5D'
  | 'SubPulse30D'
  | 'Increment'
  | 'Increment5S'
  | 'Increment30S'
  | 'Increment2M'
  | 'Increment5M'
  | 'Increment20M'
  | 'Increment1H'
  | 'Increment3H'
  | 'Increment8H'
  | 'Increment1D'
  | 'Increment5D'
  | 'Increment30D'
  | 'ToolbarColony'
  | 'ToolbarIndustry'
  | 'ToolbarMining'
  | 'ToolbarResearch'
  | 'ToolbarWealth'
  | 'ToolbarClass'
  | 'ToolbarProject'
  | 'ToolbarFleet'
  | 'ToolbarMissileDesign'
  | 'ToolbarTurrent'
  | 'ToolbarGroundForces'
  | 'ToolbarCommanders'
  | 'ToolbarMedals'
  | 'ToolbarRace'
  | 'ToolbarSystem'
  | 'ToolbarGalactic'
  | 'ToolbarComparison'
  | 'ToolbarIntelligence'
  | 'ToolbarTechnology'
  | 'ToolbarSurvey'
  | 'ToolbarSector'
  | 'ToolbarEvents'
  | 'ToolbarRefreshTactical'
  | 'ToolbarSave'
  | 'ToolbarGame'
  | 'ToolbarAuto'
  | 'ZoomIn'
  | 'ZoomOut'
  | 'Up'
  | 'Down'
  | 'Left'
  | 'Right'

/** Known Aurora form types that can be opened/inspected */
export type AuroraFormType =
  | 'EconomicsForm'
  | 'ClassDesignForm'
  | 'CreateProjectForm'
  | 'FleetWindowForm'
  | 'MissileDesignForm'
  | 'TurretDesignForm'
  | 'GroundUnitDesignForm'
  | 'CommandersWindowForm'
  | 'MedalsForm'
  | 'RaceWindowForm'
  | 'SystemViewForm'
  | 'GalacticMapForm'
  | 'RaceComparisonForm'
  | 'DiplomacyForm'
  | 'TechnologyViewForm'
  | 'MineralsForm'
  | 'SectorsForm'
  | 'EventsForm'
  | 'GameDetailsForm'
