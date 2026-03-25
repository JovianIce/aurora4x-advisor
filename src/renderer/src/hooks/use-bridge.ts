import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuroraData } from '@renderer/contexts/aurora-data-context'
import type { MemorySystemBody, MemoryFleet } from '@renderer/types/aurora'

// ---------------------------------------------------------------------------
// Push helper
// ---------------------------------------------------------------------------

interface PushPayload {
  pushType?: string
  data?: {
    systemId?: number
    bodies?: Record<string, unknown>[]
    fleets?: MemoryFleet[]
    raw?: string
  }
}

function onPushType(pushType: string, handler: (data: PushPayload['data']) => void): () => void {
  return window.api.bridge.onPush((raw: unknown) => {
    const msg = raw as PushPayload
    if (msg?.pushType === pushType && msg.data) {
      handler(msg.data)
    }
  })
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * System bodies — fetches initial data then updates via push on each game tick.
 *
 * The subscribe call tells the C# server which system to push updates for.
 * On reconnect, React Query refetches (via invalidation) and re-subscribes.
 */
export function useMemoryBodies(systemId: number | null): {
  data: MemorySystemBody[] | undefined
  isLoading: boolean
} {
  const { isConnected } = useAuroraData()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery<MemorySystemBody[]>({
    queryKey: ['memoryBodies', systemId],
    queryFn: async () => {
      await window.api.bridge.subscribeBodies(systemId!)
      const raw = await window.api.bridge.getBodies(systemId!)
      return raw as unknown as MemorySystemBody[]
    },
    enabled: isConnected && !!systemId,
    staleTime: Infinity
  })

  useEffect(() => {
    const unsub = onPushType('bodies', (pushData) => {
      if (pushData?.bodies && pushData.systemId != null) {
        queryClient.setQueryData(
          ['memoryBodies', pushData.systemId],
          pushData.bodies as unknown as MemorySystemBody[]
        )
      }
    })
    return unsub
  }, [queryClient])

  return { data, isLoading }
}

/**
 * Known star systems from the TacticalMap ComboBox.
 * Cached for 5 minutes, refreshed on reconnect via invalidation.
 */
export function useMemorySystems(): {
  data: { SystemID: number; Name: string }[] | undefined
  isLoading: boolean
} {
  const { isConnected } = useAuroraData()

  const { data, isLoading } = useQuery<{ SystemID: number; Name: string }[]>({
    queryKey: ['knownSystems'],
    queryFn: () => window.api.bridge.getKnownSystems(),
    enabled: isConnected,
    staleTime: 5 * 60 * 1000,
    retry: 3,
    retryDelay: 2000
  })

  return { data, isLoading }
}

/**
 * Fleets from live memory — fetches once, then updates via push on each game tick.
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
    staleTime: Infinity
  })

  useEffect(() => {
    const unsub = onPushType('fleets', (pushData) => {
      if (pushData?.fleets) {
        queryClient.setQueryData(['fleets'], pushData.fleets)
      }
    })
    return unsub
  }, [queryClient])

  return { data, isLoading }
}

/**
 * Parse the game date from Aurora's TacticalMap title bar.
 * Format: "EmpireName   30 December 0041 22:04:05   Racial Wealth 133,756"
 */
function parseGameDate(raw: string): string | null {
  const match = raw.match(/\d{1,2}\s+\w+\s+\d{4}\s+\d{2}:\d{2}:\d{2}/)
  return match ? match[0] : null
}

/**
 * Current game date from the TacticalMap title bar, pushed on every game tick.
 */
export function useGameDate(): string | undefined {
  const queryClient = useQueryClient()

  const { data } = useQuery<string>({
    queryKey: ['gameDate'],
    queryFn: () => Promise.resolve(''),
    enabled: false,
    staleTime: Infinity
  })

  useEffect(() => {
    const unsub = onPushType('gameDate', (pushData) => {
      if (pushData?.raw) {
        const parsed = parseGameDate(pushData.raw as string)
        if (parsed) {
          queryClient.setQueryData(['gameDate'], parsed)
        }
      }
    })
    return unsub
  }, [queryClient])

  return data || undefined
}
