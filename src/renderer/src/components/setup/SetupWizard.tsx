import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useGame } from '@renderer/hooks/use-game'
import { PersonalityMatcher } from '@components/advisor'
import type { GameInfo, GameSession } from '@shared/types'

type SetupStep = 'pick-game' | 'personality'

export function SetupWizard(): React.JSX.Element {
  const navigate = useNavigate()
  const { addGame, savedGames } = useGame()
  const [step, setStep] = useState<SetupStep>('pick-game')
  const [selectedGame, setSelectedGame] = useState<GameInfo | null>(null)

  const {
    data: dbGames,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['auroraDbGames'],
    queryFn: () => window.api.game.listGames()
  })

  // Filter out games that are already tracked
  const trackedNames = new Set(savedGames.map((g) => g.gameInfo.gameName))
  const availableGames = dbGames?.filter((g) => !trackedNames.has(g.gameName)) ?? []
  const alreadyTracked = dbGames?.filter((g) => trackedNames.has(g.gameName)) ?? []

  const finishSetup = async (archetype?: string, personalityName?: string): Promise<void> => {
    if (!selectedGame) return

    const newGame: GameSession = {
      id: `${selectedGame.gameName}-${Date.now()}`,
      gameInfo: selectedGame,
      personalityArchetype: archetype || '',
      personalityName: personalityName || '',
      createdAt: Date.now(),
      lastAccessedAt: Date.now()
    }

    await addGame(newGame)

    try {
      await window.api.dbWatcher.createInitialSnapshot()
    } catch (error) {
      console.error('[Setup] Failed to create initial snapshot:', error)
      toast.error('Warning', {
        description: 'Failed to create initial snapshot. Save in Aurora to trigger analysis.'
      })
    }

    toast.success('Campaign initialized', {
      description: `${selectedGame.gameName} is ready for operations`
    })
    navigate('/dashboard')
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header bar */}
      <div
        className="flex items-center gap-3 px-4 py-2 shrink-0"
        style={{
          background: 'var(--cic-panel)',
          borderBottom: '1px solid var(--cic-panel-edge)'
        }}
      >
        <span
          className="cic-label"
          style={{ color: 'var(--cic-amber)', letterSpacing: '0.2em', fontSize: '10px' }}
        >
          Campaign Init
        </span>
        <div style={{ width: '1px', height: '12px', background: 'var(--cic-panel-edge)' }} />
        <span
          className="cic-label"
          style={{
            color: 'var(--cic-cyan)',
            fontSize: '8px',
            letterSpacing: '0.1em'
          }}
        >
          {step === 'pick-game' ? '1. Select Game' : '2. Advisor (Optional)'}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {step === 'pick-game' && (
          <div className="h-full flex items-center justify-center p-8">
            <div className="w-full max-w-lg cic-stagger">
              <div
                className="cic-label mb-4"
                style={{ color: 'var(--cic-cyan)', fontSize: '10px' }}
              >
                Select Game from Aurora Database
              </div>

              <div className="cic-panel p-4 space-y-4">
                {isLoading && (
                  <div className="py-6 text-center">
                    <span
                      className="cic-data cic-glow"
                      style={{ color: 'var(--cic-cyan-dim)', fontSize: '10px' }}
                    >
                      Scanning Aurora database...
                    </span>
                  </div>
                )}

                {error && (
                  <div className="space-y-3">
                    <div
                      className="p-3"
                      style={{
                        background: 'rgba(255, 23, 68, 0.06)',
                        borderLeft: '2px solid var(--cic-red)'
                      }}
                    >
                      <span
                        className="cic-data"
                        style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px' }}
                      >
                        Failed to read Aurora database. Check your database path in Config.
                      </span>
                    </div>
                    <button className="cic-btn" onClick={() => refetch()}>
                      Retry Scan
                    </button>
                  </div>
                )}

                {!isLoading && !error && availableGames.length === 0 && (
                  <div className="py-4 space-y-3">
                    <span
                      className="cic-data block"
                      style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px' }}
                    >
                      {dbGames?.length === 0
                        ? 'No games found in Aurora database. Create a game in Aurora first, then return here.'
                        : 'All games in the database are already tracked.'}
                    </span>
                    <button className="cic-btn" onClick={() => refetch()}>
                      Rescan Database
                    </button>
                  </div>
                )}

                {/* Available games */}
                {availableGames.length > 0 && (
                  <div className="space-y-1">
                    {availableGames.map((game) => {
                      const isSelected = selectedGame?.gameName === game.gameName
                      return (
                        <button
                          key={game.auroraGameId}
                          className="w-full text-left p-3 transition-colors"
                          style={{
                            background: isSelected ? 'rgba(0, 229, 255, 0.06)' : 'var(--cic-void)',
                            border: `1px solid ${isSelected ? 'var(--cic-cyan)' : 'var(--cic-panel-edge)'}`,
                            boxShadow: isSelected ? '0 0 8px var(--cic-cyan-glow)' : 'none',
                            cursor: 'pointer'
                          }}
                          onClick={() => setSelectedGame(game)}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span
                              className="cic-data"
                              style={{
                                color: isSelected ? 'var(--cic-cyan)' : 'rgba(255,255,255,0.7)',
                                fontSize: '11px'
                              }}
                            >
                              {game.gameName}
                            </span>
                            <span
                              className="cic-label"
                              style={{ color: 'var(--cic-amber-dim)', fontSize: '8px' }}
                            >
                              {game.techLevel}
                            </span>
                          </div>
                          <div
                            className="cic-data"
                            style={{ color: 'rgba(255,255,255,0.3)', fontSize: '9px' }}
                          >
                            {game.empireName} — Year {game.startingYear}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* Already tracked (dimmed) */}
                {alreadyTracked.length > 0 && (
                  <div className="pt-2" style={{ borderTop: '1px solid var(--cic-panel-edge)' }}>
                    <span
                      className="cic-label"
                      style={{ fontSize: '8px', color: 'rgba(255,255,255,0.2)' }}
                    >
                      Already tracked ({alreadyTracked.length})
                    </span>
                    {alreadyTracked.map((game) => (
                      <div
                        key={game.auroraGameId}
                        className="cic-data py-1"
                        style={{ color: 'rgba(255,255,255,0.15)', fontSize: '9px' }}
                      >
                        {game.gameName}
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div
                  className="flex justify-between pt-2"
                  style={{ borderTop: '1px solid var(--cic-panel-edge)' }}
                >
                  <button className="cic-btn" onClick={() => navigate('/')}>
                    ← Back
                  </button>
                  <button
                    className="cic-btn cic-btn-amber"
                    onClick={() => setStep('personality')}
                    disabled={!selectedGame}
                    style={{ opacity: selectedGame ? 1 : 0.3 }}
                  >
                    Initialize Campaign →
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'personality' && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="cic-label" style={{ color: 'var(--cic-cyan)', fontSize: '10px' }}>
                  Advisor Assignment — {selectedGame?.gameName}
                </div>
                <div
                  className="cic-data mt-1"
                  style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px' }}
                >
                  Select an advisor personality or skip to assign later
                </div>
              </div>
              <div className="flex gap-2">
                <button className="cic-btn" onClick={() => setStep('pick-game')}>
                  ← Back
                </button>
                <button
                  className="cic-btn"
                  onClick={() => finishSetup()}
                  style={{ color: 'rgba(255,255,255,0.5)' }}
                >
                  Skip — assign later
                </button>
              </div>
            </div>
            <PersonalityMatcher onComplete={(archetype, name) => finishSetup(archetype, name)} />
          </div>
        )}
      </div>
    </div>
  )
}
