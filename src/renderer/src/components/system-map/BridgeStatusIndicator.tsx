import React from 'react'
import { useQuery } from '@tanstack/react-query'
import type { BridgeStatus } from '@shared/types'

export function BridgeStatusIndicator(): React.JSX.Element {
  const { data: status } = useQuery<BridgeStatus>({
    queryKey: ['bridgeStatus'],
    queryFn: () => window.api.bridge.getStatus(),
    refetchInterval: 3000
  })

  const isConnected = status?.isConnected ?? false

  return (
    <div className="flex items-center gap-2">
      <div className={`cic-status-dot ${isConnected ? 'online' : 'offline'}`} />
      <span className="cic-label" style={{ fontSize: '9px' }}>
        {isConnected ? 'LINK ACTIVE' : 'NO LINK'}
      </span>
    </div>
  )
}
