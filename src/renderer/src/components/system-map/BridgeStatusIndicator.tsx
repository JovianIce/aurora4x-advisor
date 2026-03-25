import React, { useState, useEffect } from 'react'
import { useAuroraData } from '@renderer/contexts/aurora-data-context'
import { toast } from 'sonner'

export function BridgeStatusIndicator(): React.JSX.Element {
  const { bridgeStatus, isConnected } = useAuroraData()
  const [prevConnected, setPrevConnected] = useState<boolean | null>(null)
  const [retrying, setRetrying] = useState(false)

  // Toast on connection transitions
  useEffect(() => {
    if (prevConnected === null) {
      setPrevConnected(isConnected)
      return
    }
    if (isConnected && !prevConnected) {
      toast.success('Bridge connected', { description: 'Receiving live data from Aurora' })
    } else if (!isConnected && prevConnected) {
      toast.warning('Bridge disconnected', { description: 'Waiting for Aurora to reconnect' })
    }
    setPrevConnected(isConnected)
  }, [isConnected, prevConnected])

  const handleRetry = async (): Promise<void> => {
    setRetrying(true)
    try {
      await window.api.bridge.reconnectNow()
    } finally {
      setTimeout(() => setRetrying(false), 1500)
    }
  }

  const label = isConnected ? 'LINK ACTIVE' : retrying ? 'CONNECTING...' : 'AWAITING AURORA'

  const errorDetail = bridgeStatus?.lastError

  return (
    <div className="flex items-center gap-2">
      <div className={`cic-status-dot ${isConnected ? 'online' : 'offline'}`} />
      <span
        className="cic-label"
        style={{ fontSize: '9px', cursor: isConnected ? 'default' : 'help' }}
        title={
          isConnected
            ? `Connected to ${bridgeStatus?.url ?? 'bridge'}`
            : `Aurora must be running with AdvisorBridge patch${errorDetail ? `\nLast error: ${errorDetail}` : ''}`
        }
      >
        {label}
      </span>
      {!isConnected && (
        <button
          className="cic-btn"
          style={{ fontSize: '8px', padding: '1px 5px' }}
          onClick={handleRetry}
          disabled={retrying}
        >
          {retrying ? '...' : 'Retry'}
        </button>
      )}
    </div>
  )
}
