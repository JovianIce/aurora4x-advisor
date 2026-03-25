import React, { createContext, useContext, useMemo, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
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

export function AuroraDataProvider({
  children
}: {
  children: React.ReactNode
}): React.JSX.Element {
  const queryClient = useQueryClient()

  // Bridge status — polled as a heartbeat
  const { data: bridgeStatus } = useQuery<BridgeStatus>({
    queryKey: ['bridgeStatus'],
    queryFn: () => window.api.bridge.getStatus(),
    refetchInterval: 2000
  })

  const isConnected = bridgeStatus?.isConnected ?? false

  // On connect/disconnect events from main process, invalidate everything so
  // hooks re-fetch and re-subscribe automatically.
  useEffect(() => {
    const unsubConnect = window.api.bridge.onConnected(() => {
      console.log('[AuroraData] Bridge connected — invalidating queries')
      queryClient.invalidateQueries()
    })

    const unsubDisconnect = window.api.bridge.onDisconnected(() => {
      console.log('[AuroraData] Bridge disconnected')
      queryClient.invalidateQueries({ queryKey: ['bridgeStatus'] })
    })

    return () => {
      unsubConnect()
      unsubDisconnect()
    }
  }, [queryClient])

  // Tables — manual refresh only (DB queries can trigger Save() which crashes)
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
