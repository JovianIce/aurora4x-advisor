import React, {
  createContext,
  useContext,
  useMemo,
  useEffect,
  useRef,
  useState,
  useCallback
} from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { BridgeStatus } from '@shared/types'

interface TableInfo {
  name: string
  rows: number
}

// Body type mapping from Aurora DB:
// BodyClass 1 = Planet:    BodyTypeID 2=Terrestrial, 3=Dwarf, 4=GasGiant, 5=SuperJovian
// BodyClass 2 = Moon:      BodyTypeID 7=Small, 8=SmallTerrestrial, 9=Large, 10=LargeTerrestrial
// BodyClass 3 = Asteroid:  BodyTypeID 1=Asteroid
// BodyClass 5 = Comet:     BodyTypeID 14=Comet

// Mapped system body from live memory (kc type)
export interface MemorySystemBody {
  SystemBodyID: number
  SystemID: number
  StarID: number
  PlanetNumber: number
  OrbitNumber: number
  ParentBodyID: number
  ParentBodyType: number
  BodyClass: string // sub-type string from memory: "Terrestrial", "GasGiant", "Comet", etc.
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

// Bridge now sends human-readable field names directly — cast to MemorySystemBody
function mapBody(raw: Record<string, unknown>): MemorySystemBody {
  return raw as unknown as MemorySystemBody
}

interface AuroraDataContextValue {
  // Connection
  bridgeStatus: BridgeStatus | null
  isConnected: boolean

  // Table discovery (DB - refreshes every 10 min)
  tables: TableInfo[]
  tablesLoading: boolean
  refetchTables: () => void

  // Raw query
  queryTable: <T = Record<string, unknown>>(sql: string) => Promise<T[]>
}

const AuroraDataContext = createContext<AuroraDataContextValue | null>(null)

export function AuroraDataProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  // Bridge status - poll every 2 seconds
  const { data: bridgeStatus } = useQuery<BridgeStatus>({
    queryKey: ['bridgeStatus'],
    queryFn: () => window.api.bridge.getStatus(),
    refetchInterval: 2000
  })

  const isConnected = bridgeStatus?.isConnected ?? false

  // All tables with row counts - manual refresh only (DB queries trigger Save() which can crash)
  const {
    data: tables,
    isLoading: tablesLoading,
    refetch: refetchTables
  } = useQuery<TableInfo[]>({
    queryKey: ['allTables'],
    queryFn: () => window.api.bridge.getAllTables(),
    enabled: false
  })

  const value = useMemo<AuroraDataContextValue>(
    () => ({
      bridgeStatus: bridgeStatus ?? null,
      isConnected,
      tables: tables ?? [],
      tablesLoading,
      refetchTables,
      queryTable: <T,>(sql: string) => window.api.bridge.query(sql) as Promise<T[]>
    }),
    [bridgeStatus, isConnected, tables, tablesLoading, refetchTables]
  )

  return <AuroraDataContext.Provider value={value}>{children}</AuroraDataContext.Provider>
}

export function useAuroraData(): AuroraDataContextValue {
  const ctx = useContext(AuroraDataContext)
  if (!ctx) throw new Error('useAuroraData must be used within AuroraDataProvider')
  return ctx
}

// Live system bodies from memory - push-based (server broadcasts on game tick)
export function useMemoryBodies(systemId: number | null): {
  data: MemorySystemBody[] | undefined
  isLoading: boolean
  refetch: () => void
} {
  const { isConnected } = useAuroraData()
  const [data, setData] = useState<MemorySystemBody[] | undefined>()
  const [isLoading, setIsLoading] = useState(false)
  const subscribedRef = useRef<number | null>(null)

  // Subscribe to system when it changes
  useEffect(() => {
    if (!isConnected || !systemId) {
      setData(undefined)
      subscribedRef.current = null
      return
    }

    if (subscribedRef.current === systemId) return
    subscribedRef.current = systemId
    setIsLoading(true)

    // Subscribe tells the server which system to watch
    window.api.bridge.subscribeBodies(systemId).catch(() => {})

    // Also fetch initial data immediately
    window.api.bridge
      .getMemoryBodies2(systemId)
      .then((raw) => {
        setData(raw.map(mapBody))
        setIsLoading(false)
      })
      .catch(() => setIsLoading(false))
  }, [isConnected, systemId])

  // Listen for push notifications from server
  useEffect(() => {
    if (!isConnected) return

    const unsub = window.api.bridge.onPush((payload: unknown) => {
      const msg = payload as {
        pushType?: string
        data?: { systemId?: number; bodies?: Record<string, unknown>[] }
      }
      if (msg?.pushType === 'bodies' && msg.data?.bodies) {
        if (msg.data.systemId === subscribedRef.current) {
          setData(msg.data.bodies.map(mapBody))
        }
      }
    })

    return unsub
  }, [isConnected])

  const refetch = useCallback(() => {
    if (!systemId || !isConnected) return
    window.api.bridge
      .getMemoryBodies2(systemId)
      .then((raw) => {
        setData(raw.map(mapBody))
      })
      .catch(() => {})
  }, [systemId, isConnected])

  return { data, isLoading, refetch }
}

// Live stars from memory - auto-refreshing
export function useMemoryStars(systemId: number | null): {
  data: Record<string, unknown>[] | undefined
  isLoading: boolean
} {
  const { isConnected } = useAuroraData()

  const { data, isLoading } = useQuery<Record<string, unknown>[]>({
    queryKey: ['memoryStars', systemId],
    queryFn: () => window.api.bridge.getMemoryBodies(systemId!),
    enabled: isConnected && !!systemId,
    refetchInterval: isConnected && !!systemId ? 2000 : false,
    staleTime: 1800
  })

  return { data, isLoading }
}

// Surveyed systems list - single DB query, no auto-refresh
export function useMemorySystems(
  gameId?: number | null,
  raceId?: number | null
): {
  data: { SystemID: number; Name: string }[] | undefined
  isLoading: boolean
} {
  const { isConnected } = useAuroraData()
  // Read known systems directly from TacticalMap ComboBox — no DB query needed
  const { data, isLoading } = useQuery<{ SystemID: number; Name: string }[]>({
    queryKey: ['knownSystems'],
    queryFn: async () => {
      console.log('[useMemorySystems] calling getKnownSystems...')
      const result = await window.api.bridge.getKnownSystems()
      console.log('[useMemorySystems] got', result?.length, 'systems')
      return result
    },
    enabled: isConnected,
    staleTime: 5 * 60 * 1000,
    retry: 3,
    retryDelay: 2000
  })

  return { data, isLoading }
}

// Fleet from live memory
export interface MemoryFleet {
  FleetID: number
  FleetName: string
  Speed: number
  Xcor: number
  Ycor: number
  RaceID: number
  ShipCount: number
  SystemID: number // 0 if in transit (no orbit body)
  SystemName: string // always set from navigation ref
  IsCivilian: boolean
}

/**
 * Hook to read fleets. Fetches once on mount, then updates via push on game tick.
 */
export function useFleets(): {
  data: MemoryFleet[] | undefined
  isLoading: boolean
} {
  const { isConnected } = useAuroraData()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery<MemoryFleet[]>({
    queryKey: ['fleets'],
    queryFn: async () => {
      const raw = await window.api.bridge.getFleets()
      return raw as MemoryFleet[]
    },
    enabled: isConnected,
    staleTime: Infinity // updated via push from game tick
  })

  // Listen for fleet push updates from game tick
  useEffect(() => {
    const unsub = window.api.bridge.onPush((payload: unknown) => {
      const p = payload as { pushType?: string; data?: { fleets?: MemoryFleet[] } }
      if (p?.pushType === 'fleets' && p.data?.fleets) {
        queryClient.setQueryData(['fleets'], p.data.fleets)
      }
    })
    return unsub
  }, [queryClient])

  return { data, isLoading }
}
