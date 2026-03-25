import React from 'react'
import { useQuery } from '@tanstack/react-query'
import type { GameInfo } from '@shared/types'

interface GameDetectionProps {
  gameName: string
  onGameDetected: (gameInfo: GameInfo) => void
  onBack: () => void
}

export function GameDetection({
  gameName,
  onGameDetected,
  onBack
}: GameDetectionProps): React.JSX.Element {
  const {
    data: gameInfo,
    isLoading: isDetecting,
    error,
    refetch
  } = useQuery({
    queryKey: ['game-detection', gameName],
    queryFn: () => window.api.game.detectGame(gameName),
    retry: false
  })

  return (
    <div className="h-full flex items-center justify-center p-8">
      <div className="w-full max-w-md cic-stagger">
        <div className="cic-label mb-4" style={{ color: 'var(--cic-cyan)', fontSize: '10px' }}>
          Step 3 — Database Scan
        </div>

        <div className="cic-panel p-4 space-y-4">
          {/* Scanning */}
          {isDetecting && (
            <div className="py-6 text-center space-y-3">
              <div
                className="cic-data cic-glow"
                style={{ color: 'var(--cic-cyan)', fontSize: '11px' }}
              >
                Scanning Aurora database for &quot;{gameName}&quot;...
              </div>
              <div
                className="mx-auto"
                style={{
                  width: '120px',
                  height: '2px',
                  background: `linear-gradient(90deg, transparent, var(--cic-cyan), transparent)`,
                  animation: 'cic-glow-pulse 1.5s ease-in-out infinite'
                }}
              />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="space-y-3">
              <div
                className="p-3"
                style={{
                  background: 'rgba(255, 23, 68, 0.06)',
                  border: '1px solid rgba(255, 23, 68, 0.2)',
                  borderLeft: '2px solid var(--cic-red)'
                }}
              >
                <div className="cic-label mb-1" style={{ color: 'var(--cic-red)', fontSize: '9px' }}>
                  Scan Failed
                </div>
                <p className="cic-data" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px' }}>
                  {error instanceof Error ? error.message : 'Failed to detect game'}
                </p>
              </div>
              <div className="cic-data space-y-1" style={{ color: 'rgba(255,255,255,0.3)', fontSize: '9px' }}>
                <p style={{ color: 'var(--cic-amber-dim)' }}>Troubleshooting:</p>
                <p>— Verify game was saved in Aurora</p>
                <p>— Check name matches exactly (case-sensitive)</p>
                <p>— Confirm database path in Config</p>
              </div>
            </div>
          )}

          {/* Success */}
          {gameInfo && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="cic-status-dot online" />
                <span className="cic-data" style={{ color: 'var(--cic-green)', fontSize: '11px' }}>
                  Campaign detected: {gameInfo.gameName}
                </span>
              </div>

              <div
                className="space-y-2 p-3"
                style={{ background: 'var(--cic-void)', border: '1px solid var(--cic-panel-edge)' }}
              >
                <div className="flex justify-between">
                  <span className="cic-label" style={{ fontSize: '9px' }}>Year</span>
                  <span className="cic-data" style={{ color: 'var(--cic-cyan-dim)', fontSize: '10px' }}>
                    {gameInfo.startingYear}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="cic-label" style={{ fontSize: '9px' }}>Tech Level</span>
                  <span className="cic-data" style={{ color: 'var(--cic-cyan-dim)', fontSize: '10px' }}>
                    {gameInfo.techLevel}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="cic-label" style={{ fontSize: '9px' }}>Empire</span>
                  <span className="cic-data" style={{ color: 'var(--cic-cyan-dim)', fontSize: '10px' }}>
                    {gameInfo.empireName}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-between pt-1" style={{ borderTop: '1px solid var(--cic-panel-edge)' }}>
            <button className="cic-btn" onClick={onBack}>
              ← Back
            </button>
            {error && (
              <button className="cic-btn cic-btn-amber" onClick={() => refetch()}>
                Retry Scan
              </button>
            )}
            {gameInfo && (
              <button
                className="cic-btn cic-btn-amber"
                onClick={() => onGameDetected(gameInfo)}
              >
                Proceed →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
