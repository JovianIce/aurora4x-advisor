import React, { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useGame } from '@renderer/hooks/use-game'
import { useAuroraData } from '@renderer/contexts/aurora-data-context'
import { useGameDate } from '@renderer/hooks/use-bridge'
import { AdviceSection } from './AdviceSection'

function formatArchetype(archetype: string): string {
  return archetype
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function DashboardOverview(): React.JSX.Element {
  const { currentGame } = useGame()
  const { isConnected } = useAuroraData()
  const queryClient = useQueryClient()
  const gameDate = useGameDate()

  // Load initial advice using React Query
  const { data: advice } = useQuery({
    queryKey: ['advice', currentGame?.id],
    queryFn: async () => {
      if (!currentGame?.personalityArchetype) return null

      const profiles = await window.api.advisor.loadAllProfiles()
      const matchingProfile = profiles.find(
        (p: { archetype: string }) => p.archetype === currentGame.personalityArchetype
      )
      if (!matchingProfile?.id) return null

      const settings = await window.api.settings.load()

      const initialAdvice = await window.api.advisor.triggerInitialAnalysis(
        settings.auroraDbPath || '',
        matchingProfile.id
      )
      return initialAdvice
    },
    enabled: !!currentGame?.personalityArchetype && isConnected,
    staleTime: 5 * 60 * 1000
  })

  // Load advisor greeting
  const { data: greeting } = useQuery({
    queryKey: ['greeting', currentGame?.id, currentGame?.personalityArchetype],
    queryFn: async () => {
      if (!currentGame?.personalityArchetype) return null

      const profiles = await window.api.advisor.loadAllProfiles()
      const matchingProfile = profiles.find(
        (p: { archetype: string }) => p.archetype === currentGame.personalityArchetype
      )
      if (!matchingProfile?.id) return null

      const greetingKey = `advisor-seen-${currentGame.id}`
      const hasSeenBefore = localStorage.getItem(greetingKey) === 'true'
      const isInitial = !hasSeenBefore
      if (isInitial) {
        localStorage.setItem(greetingKey, 'true')
      }

      return window.api.advisor.getGreeting(matchingProfile.id, isInitial)
    },
    enabled: !!currentGame?.personalityArchetype,
    staleTime: Infinity
  })

  // Listen for advice updates from bridge push
  useEffect(() => {
    if (!currentGame) return

    const unsubscribe = window.api.advisor.onAdviceUpdate((adviceData: unknown) => {
      queryClient.setQueryData(['advice', currentGame.id], adviceData)
    })

    return unsubscribe
  }, [currentGame, queryClient])

  // Re-fetch advice when bridge connects
  useEffect(() => {
    if (isConnected && currentGame?.personalityArchetype) {
      queryClient.invalidateQueries({ queryKey: ['advice', currentGame.id] })
    }
  }, [isConnected]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!currentGame) {
    return (
      <div className="cic-panel p-6 text-center">
        <span className="cic-data" style={{ color: 'var(--cic-cyan-dim)' }}>
          No campaign selected. Initialize one from Fleet Command.
        </span>
      </div>
    )
  }

  const gameState = (advice as { gameState?: Record<string, unknown> } | null)?.gameState
  const analyzedAt = (advice as { analyzedAt?: number } | null)?.analyzedAt

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {/* Header: Game Info + Advisor */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Game Info Panel */}
        <div className="cic-panel">
          <div className="cic-panel-header">Campaign Status</div>
          <div className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="cic-data" style={{ color: 'var(--cic-cyan)', fontSize: '13px' }}>
                {currentGame.gameInfo.gameName}
              </span>
              <span className="cic-label" style={{ color: 'var(--cic-amber)', fontSize: '9px' }}>
                {currentGame.gameInfo.techLevel}
              </span>
            </div>
            <div className="cic-data" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px' }}>
              {currentGame.gameInfo.empireName} —{' '}
              {gameDate || `Year ${currentGame.gameInfo.startingYear}`}
            </div>

            {/* Live data stats from bridge */}
            {gameState && (
              <div
                className="grid grid-cols-2 gap-x-4 gap-y-1 pt-2 mt-2"
                style={{ borderTop: '1px solid var(--cic-panel-edge)' }}
              >
                <div className="flex justify-between">
                  <span className="cic-label" style={{ fontSize: '9px' }}>
                    Systems
                  </span>
                  <span
                    className="cic-data"
                    style={{ fontSize: '9px', color: 'var(--cic-cyan-dim)' }}
                  >
                    {String(gameState.systemCount ?? '—')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="cic-label" style={{ fontSize: '9px' }}>
                    Bodies
                  </span>
                  <span
                    className="cic-data"
                    style={{ fontSize: '9px', color: 'var(--cic-cyan-dim)' }}
                  >
                    {String(gameState.bodyCount ?? '—')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="cic-label" style={{ fontSize: '9px' }}>
                    Fleets
                  </span>
                  <span
                    className="cic-data"
                    style={{ fontSize: '9px', color: 'var(--cic-cyan-dim)' }}
                  >
                    {String(gameState.fleetCount ?? '—')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="cic-label" style={{ fontSize: '9px' }}>
                    Ships
                  </span>
                  <span
                    className="cic-data"
                    style={{ fontSize: '9px', color: 'var(--cic-cyan-dim)' }}
                  >
                    {String(gameState.totalShipCount ?? '—')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="cic-label" style={{ fontSize: '9px' }}>
                    Military
                  </span>
                  <span
                    className="cic-data"
                    style={{ fontSize: '9px', color: 'var(--cic-cyan-dim)' }}
                  >
                    {String(gameState.militaryFleetCount ?? '—')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="cic-label" style={{ fontSize: '9px' }}>
                    Civilian
                  </span>
                  <span
                    className="cic-data"
                    style={{ fontSize: '9px', color: 'var(--cic-cyan-dim)' }}
                  >
                    {String(gameState.civilianFleetCount ?? '—')}
                  </span>
                </div>
              </div>
            )}

            {!isConnected && !gameState && (
              <div className="pt-2 mt-2" style={{ borderTop: '1px solid var(--cic-panel-edge)' }}>
                <span
                  className="cic-data"
                  style={{ color: 'var(--cic-amber-dim)', fontSize: '9px' }}
                >
                  Awaiting bridge connection for live data...
                </span>
              </div>
            )}

            {analyzedAt && (
              <div
                className="cic-data pt-1"
                style={{ color: 'rgba(255,255,255,0.2)', fontSize: '8px' }}
              >
                Last analyzed:{' '}
                {new Date(analyzedAt).toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
            )}
          </div>
        </div>

        {/* Advisor Panel */}
        <div className="cic-panel">
          <div className="cic-panel-header">Strategic Advisor</div>
          <div className="p-3 space-y-2">
            {currentGame.personalityName ? (
              <>
                <div className="flex items-center justify-between">
                  <span
                    className="cic-data"
                    style={{ color: 'var(--cic-amber)', fontSize: '13px' }}
                  >
                    {currentGame.personalityName}
                  </span>
                </div>
                <div
                  className="cic-data"
                  style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px' }}
                >
                  {formatArchetype(currentGame.personalityArchetype || '')}
                </div>
                {greeting && (
                  <div
                    className="mt-2 p-2"
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--cic-panel-edge)',
                      borderRadius: '4px'
                    }}
                  >
                    <p
                      className="cic-data italic"
                      style={{ color: 'var(--cic-cyan-dim)', fontSize: '10px', lineHeight: '1.5' }}
                    >
                      &quot;{greeting}&quot;
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div
                className="cic-data py-4 text-center"
                style={{ color: 'var(--cic-cyan-dim)', fontSize: '10px' }}
              >
                No advisor assigned. Use Fleet Command sidebar to assign one.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tips & Advice Section */}
      <AdviceSection advice={advice} profileId={currentGame.personalityArchetype} />
    </div>
  )
}
