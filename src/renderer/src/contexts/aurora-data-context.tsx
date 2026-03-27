import React, { createContext, useContext, useMemo, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { BridgeStatus } from '@shared/types'

interface TableInfo {
  name: string
  rows: number
}

export interface AuroraDataContextValue {
  bridgeStatus: BridgeStatus | null
  isConnected: boolean
  tables: TableInfo[]
  tablesLoading: boolean
  refetchTables: () => void
  queryTable: <T = Record<string, unknown>>(sql: string) => Promise<T[]>
}

const AuroraDataContext = createContext<AuroraDataContextValue | null>(null)

export function AuroraDataProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const queryClient = useQueryClient()

  // Bridge status — polled as a heartbeat
  const { data: bridgeStatus } = useQuery<BridgeStatus>({
    queryKey: ['bridgeStatus'],
    queryFn: () => window.api.bridge.getStatus(),
    refetchInterval: 2000
  })

  const isConnected = bridgeStatus?.isConnected ?? false

  // On connect/disconnect/mismatch events from main process
  useEffect(() => {
    const unsubConnect = window.api.bridge.onConnected(() => {
      console.log('[AuroraData] Bridge connected — invalidating queries')
      // Dismiss stale mismatch warnings — they'll re-fire if still wrong
      toast.dismiss('game-mismatch')
      toast.dismiss('db-path-mismatch')
      queryClient.invalidateQueries()
    })

    const unsubDisconnect = window.api.bridge.onDisconnected(() => {
      console.log('[AuroraData] Bridge disconnected')
      queryClient.invalidateQueries({ queryKey: ['bridgeStatus'] })
    })

    const unsubVersion = window.api.bridge.onVersionMismatch((data) => {
      console.warn('[AuroraData] Bridge version mismatch:', data)
      toast.warning('Bridge update required', {
        description: (
          <div>
            Your AdvisorBridge (v{data.bridgeVersion}) is outdated. The app expects v
            {data.appVersion}.
            <br />
            <a
              href="https://github.com/ZionLG/aurora4x-advisor/releases/latest"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--cic-cyan)', textDecoration: 'underline' }}
            >
              Download latest bridge
            </a>
          </div>
        ),
        duration: Infinity
      })
    })

    // DB path mismatch — watcher configured for a different Aurora installation
    const unsubDbPath = window.api.bridge.onDbPathMismatch((data) => {
      console.warn('[AuroraData] DB path mismatch:', data)
      toast.warning('Database path mismatch', {
        id: 'db-path-mismatch',
        description: `The app is watching a different database than Aurora is using. Update your Aurora DB path in settings.`,
        duration: Infinity
      })
    })

    return () => {
      unsubConnect()
      unsubDisconnect()
      unsubVersion()
      unsubDbPath()
    }
  }, [queryClient])

  // Tables — manual refresh only
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

// eslint-disable-next-line react-refresh/only-export-components
export function useAuroraData(): AuroraDataContextValue {
  const ctx = useContext(AuroraDataContext)
  if (!ctx) throw new Error('useAuroraData must be used within AuroraDataProvider')
  return ctx
}
