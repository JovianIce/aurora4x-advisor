import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useGame } from '@renderer/hooks/use-game'
import { useSettings } from '@renderer/hooks/use-settings'
import { useAuroraData } from '@renderer/contexts/aurora-data-context'
import { toast } from 'sonner'

function BootLine({
  children,
  status = 'ok',
  delay = 0
}: {
  children: React.ReactNode
  status?: 'ok' | 'warn' | 'fail' | 'wait' | 'none'
  delay?: number
}): React.JSX.Element {
  const [visible, setVisible] = useState(delay === 0)

  useEffect(() => {
    if (delay > 0) {
      const t = setTimeout(() => setVisible(true), delay)
      return (): void => { clearTimeout(t) }
    }
    return undefined
  }, [delay])

  if (!visible) return <div style={{ height: '18px' }} />

  const statusColors: Record<string, string> = {
    ok: 'var(--cic-green)',
    warn: 'var(--cic-amber)',
    fail: 'var(--cic-red)',
    wait: 'var(--cic-cyan-dim)'
  }

  const statusLabels: Record<string, string> = {
    ok: '[  OK  ]',
    warn: '[ WARN ]',
    fail: '[ FAIL ]',
    wait: '[ .... ]'
  }

  return (
    <div
      className="flex items-center gap-3"
      style={{ animation: 'cic-fade-in 0.15s ease-out' }}
    >
      {status !== 'none' && (
        <span
          className="cic-data shrink-0"
          style={{ color: statusColors[status], fontSize: '10px', width: '60px' }}
        >
          {statusLabels[status]}
        </span>
      )}
      <span className="cic-data" style={{ color: 'rgba(255,255,255,0.6)', fontSize: '10px' }}>
        {children}
      </span>
    </div>
  )
}

export function WelcomeScreen(): React.JSX.Element {
  const navigate = useNavigate()
  const { currentGame, savedGames } = useGame()
  const { settings } = useSettings()
  const { isConnected } = useAuroraData()
  const [bootDone, setBootDone] = useState(false)

  // Query games from Aurora DB
  const { data: dbGames } = useQuery({
    queryKey: ['auroraDbGames'],
    queryFn: () => window.api.game.listGames(),
    enabled: !!settings?.auroraDbPath
  })

  // Auto-redirect returning users to dashboard
  useEffect(() => {
    if (currentGame) {
      navigate('/dashboard')
    }
  }, [currentGame, navigate])

  // Boot sequence timing
  useEffect(() => {
    const t = setTimeout(() => setBootDone(true), 1100)
    return () => clearTimeout(t)
  }, [])

  const hasDbPath = !!settings?.auroraDbPath
  const hasGames = savedGames.length > 0

  const handleNewCampaign = (): void => {
    if (!hasDbPath) {
      toast.info('Database not configured', {
        description: 'Set your Aurora database path before starting a game'
      })
      navigate('/settings')
      return
    }
    navigate('/setup')
  }

  // Don't render if we're about to redirect
  if (currentGame) return <div />

  return (
    <div className="h-full flex items-center justify-center p-8">
      <div className="w-full max-w-xl">
        {/* Terminal header */}
        <div
          className="px-4 py-2 flex items-center justify-between"
          style={{
            background: 'var(--cic-panel)',
            borderBottom: '1px solid var(--cic-panel-edge)',
            borderTop: '1px solid var(--cic-cyan)',
            boxShadow: '0 -1px 8px var(--cic-cyan-glow)'
          }}
        >
          <span
            className="cic-label"
            style={{ color: 'var(--cic-cyan)', letterSpacing: '0.25em', fontSize: '10px' }}
          >
            Aurora CIC — Strategic Advisor Terminal
          </span>
          <span className="cic-data" style={{ color: 'rgba(255,255,255,0.2)', fontSize: '9px' }}>
            v0.2 alpha
          </span>
        </div>

        {/* Terminal body */}
        <div
          className="relative overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, var(--cic-deep) 0%, var(--cic-void) 100%)',
            border: '1px solid var(--cic-panel-edge)',
            borderTop: 'none'
          }}
        >
          {/* Scanline effect */}
          <div className="cic-scanline absolute inset-0 pointer-events-none" />

          <div className="p-5 space-y-1 relative z-10">
            {/* Boot sequence lines */}
            <BootLine status="none" delay={0}>
              Initializing Aurora Strategic Advisor...
            </BootLine>
            <BootLine status="ok" delay={100}>
              Core systems loaded
            </BootLine>
            <BootLine status={hasDbPath ? 'ok' : 'fail'} delay={250}>
              Aurora database: {hasDbPath ? settings?.auroraDbPath?.split(/[\\/]/).pop() : 'NOT CONFIGURED'}
            </BootLine>
            <BootLine status={isConnected ? 'ok' : 'wait'} delay={400}>
              Bridge connection: {isConnected ? 'LINK ACTIVE' : 'Awaiting Aurora'}
            </BootLine>
            <BootLine
              status={hasDbPath ? (dbGames && dbGames.length > 0 ? 'ok' : 'warn') : 'wait'}
              delay={550}
            >
              Games in Aurora DB: {hasDbPath ? (dbGames ? String(dbGames.length) : 'scanning...') : 'N/A'}
            </BootLine>
            <BootLine status={hasGames ? 'ok' : 'warn'} delay={700}>
              Tracked campaigns: {savedGames.length}
            </BootLine>

            {/* Divider */}
            {bootDone && <div className="cic-line-draw my-3" />}

            {/* Action area — appears after boot */}
            {bootDone && (
              <div className="pt-2 space-y-4" style={{ animation: 'cic-slide-up 0.3s ease-out' }}>
                {/* First-time user: no DB configured */}
                {!hasDbPath && (
                  <div
                    className="p-3"
                    style={{
                      background: 'rgba(255, 179, 0, 0.05)',
                      border: '1px solid var(--cic-amber-dim)',
                      borderLeft: '2px solid var(--cic-amber)'
                    }}
                  >
                    <div
                      className="cic-label mb-2"
                      style={{ color: 'var(--cic-amber)', fontSize: '9px' }}
                    >
                      First-Time Setup Required
                    </div>
                    <p
                      className="cic-data mb-3"
                      style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', lineHeight: '1.6' }}
                    >
                      Configure the path to your Aurora 4X database (AuroraDB.db) to begin.
                      The advisor reads this file to track your game state.
                    </p>
                    <button className="cic-btn cic-btn-amber" onClick={() => navigate('/settings')}>
                      Configure Database Path
                    </button>
                  </div>
                )}

                {/* DB configured: ready to go */}
                {hasDbPath && (
                  <div className="flex items-center gap-2">
                    <button className="cic-btn cic-btn-amber" onClick={handleNewCampaign}>
                      + Initialize New Campaign
                    </button>
                    {hasGames && (
                      <span
                        className="cic-data"
                        style={{ color: 'rgba(255,255,255,0.25)', fontSize: '9px' }}
                      >
                        or select from Fleet Command sidebar
                      </span>
                    )}
                  </div>
                )}

                {/* Footer status */}
                <div
                  className="flex items-center justify-between pt-2"
                  style={{ borderTop: '1px solid var(--cic-panel-edge)' }}
                >
                  <span
                    className="cic-data"
                    style={{ color: 'rgba(255,255,255,0.15)', fontSize: '9px' }}
                  >
                    Ready for input
                    <span className="cic-cursor ml-1">&nbsp;</span>
                  </span>
                  <span
                    className="cic-data"
                    style={{ color: 'rgba(255,255,255,0.1)', fontSize: '8px' }}
                  >
                    Aurora 4X Strategic Advisor
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
