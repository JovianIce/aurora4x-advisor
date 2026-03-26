import { ElectronAPI } from '@electron-toolkit/preload'
import type {
  ArchetypeId,
  Archetype,
  IdeologyProfile,
  PersonalityMatch,
  GameInfo,
  GameSession,
  AppSettings,
  BridgeStatus,
  ActionRequest
} from '@shared/types'

interface Profile {
  id: string
  archetype: string
  name: string
  keywords: string[]
  description: string
}

interface TutorialAdvice {
  id: string
  conditions: Record<string, unknown>
  body: string
}

interface Observation {
  id: string
  data: Record<string, unknown>
  message?: string
}

interface GameState {
  gameYear: number
  hasTNTech: boolean
  alienContact: boolean
  atWar: boolean
  hasBuiltFirstShip: boolean
  hasSurveyedHomeSystem: boolean
}

interface AdvicePackage {
  gameState: GameState
  tutorials: TutorialAdvice[]
  observations: Observation[]
  analyzedAt: number
}

interface MemoryFleet {
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

interface GameStateFieldInfo {
  name: string
  type: string
  value?: unknown
  count?: number
  itemFields?: number
  refFields?: number
}

interface CollectionInfo {
  field: string
  collectionType: 'Dict' | 'List'
  keyType: string | null
  itemType: string
  count: number
  fieldCount: number
  schema: { name: string; type: string }[]
}

interface AdvisorAPI {
  getAllArchetypes: () => Promise<Archetype[]>
  getArchetype: (id: ArchetypeId) => Promise<Archetype>
  matchPersonality: (archetype: ArchetypeId, ideology: IdeologyProfile) => Promise<PersonalityMatch>
  // V2 Profile API
  loadProfile: (profileId: string) => Promise<Profile>
  loadAllProfiles: () => Promise<Profile[]>
  getGreeting: (profileId: string, isInitial: boolean) => Promise<string>
  getObservationMessage: (
    profileId: string,
    observationId: string,
    observation: unknown,
    gameState: unknown
  ) => Promise<string>
  getTutorialAdvice: (profileId: string, gameState: unknown) => Promise<TutorialAdvice[]>
  triggerInitialAnalysis: (dbPath: string, profileId: string) => Promise<AdvicePackage>
  onAdviceUpdate: (callback: (advice: AdvicePackage) => void) => () => void
}

interface GameAPI {
  listGames: () => Promise<GameInfo[]>
  detectGame: (gameName: string) => Promise<GameInfo>
}

interface GamesAPI {
  load: () => Promise<GameSession[]>
  save: (games: GameSession[]) => Promise<void>
  addOrUpdate: (game: GameSession) => Promise<GameSession[]>
  remove: (gameId: string) => Promise<GameSession[]>
  updatePersonality: (
    gameId: string,
    archetype: string,
    name: string
  ) => Promise<GameSession | null>
  updateLastAccessed: (gameId: string) => Promise<GameSession | null>
  clearAll: () => Promise<void>
}

interface SettingsAPI {
  load: () => Promise<AppSettings>
  save: (settings: AppSettings) => Promise<void>
  update: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<AppSettings>
}

interface DbWatcherStatus {
  isWatching: boolean
  auroraDbPath: string | null
  currentGameId: string | null
}

interface DbWatcherAPI {
  setPath: (dbPath: string | null) => Promise<DbWatcherStatus>
  setCurrentGame: (gameId: string | null) => Promise<DbWatcherStatus>
  getStatus: () => Promise<DbWatcherStatus>
  pickFile: () => Promise<string | null>
  createInitialSnapshot: () => Promise<void>
}

interface BridgeAPI {
  // Connection
  connect: (port?: number) => Promise<BridgeStatus>
  disconnect: () => Promise<BridgeStatus>
  reconnectNow: () => Promise<BridgeStatus>
  getStatus: () => Promise<BridgeStatus>
  onConnected: (callback: () => void) => () => void
  onDisconnected: (callback: () => void) => () => void
  onVersionMismatch: (
    callback: (data: { bridgeVersion: number; appVersion: number }) => void
  ) => () => void
  onPush: (callback: (data: unknown) => void) => () => void
  // Real-time memory data
  subscribeBodies: (systemId: number | null) => Promise<unknown>
  getBodies: (systemId?: number) => Promise<Record<string, unknown>[]>
  getKnownSystems: () => Promise<{ SystemID: number; Name: string }[]>
  getFleets: () => Promise<MemoryFleet[]>
  // SQL + actions
  query: (sql: string) => Promise<unknown[]>
  queryFull: (sql: string) => Promise<unknown[]>
  getTableMapping: () => Promise<unknown>
  rediscoverMapping: () => Promise<unknown>
  getAllTables: () => Promise<{ name: string; rows: number }[]>
  getTableInfo: (tableName: string) => Promise<unknown[]>
  executeAction: (action: ActionRequest) => Promise<unknown>
  // Dev tools
  dumpMemory: () => Promise<{
    outputDir: string
    collections: number
    totalItems: number
    elapsedMs: number
    files: string[]
    errors: string[]
  } | null>
  enumerateGameState: () => Promise<GameStateFieldInfo[]>
  enumerateCollections: () => Promise<CollectionInfo[]>
  readCollection: (params: {
    Field: string
    Offset?: number
    Limit?: number
    Fields?: string[]
    IncludeRefs?: boolean
    FilterField?: string
    FilterValue?: string
  }) => Promise<Record<string, unknown>[]>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      advisor: AdvisorAPI
      game: GameAPI
      games: GamesAPI
      settings: SettingsAPI
      dbWatcher: DbWatcherAPI
      bridge: BridgeAPI
    }
  }
}
