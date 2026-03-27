import React, { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { GameContext } from './game-context'
import type { GameSession } from '@shared/types'

/**
 * Game session provider — the renderer is DISPLAY ONLY.
 *
 * The main process (GameSessionService) owns:
 *   - Which game is selected
 *   - Which game Aurora is running
 *   - Lock enforcement
 *
 * This provider:
 *   - Listens to `gameSession:state` events from main
 *   - Sends `gameSession:setCurrent` requests to main
 *   - Never manages currentGameId as local state
 */

interface GameProviderProps {
  children: React.ReactNode
}

interface SessionState {
  currentGame: GameSession | null
  runningGameId: number | null
  runningGameName: string | null
  lockedCampaignId: string | null
}

export function GameProvider({ children }: GameProviderProps): React.JSX.Element {
  const queryClient = useQueryClient()

  // Session state — mirrors main process, never set locally
  const [session, setSession] = useState<SessionState>({
    currentGame: null,
    runningGameId: null,
    runningGameName: null,
    lockedCampaignId: null
  })

  // Query: Load all saved games (just the list, not selection)
  const {
    data: savedGames = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ['games'],
    queryFn: () => window.api.games.load()
  })

  // Listen for state broadcasts from main process
  useEffect(() => {
    const unsub = window.api.bridge.onSessionState((state: SessionState) => {
      console.log('[GameProvider] State from main:', state.currentGame?.gameInfo.gameName ?? 'none',
        `running=${state.runningGameName}`, `locked=${state.lockedCampaignId ? 'yes' : 'no'}`)
      setSession(state)

      // Dismiss stale toasts when state changes
      if (state.currentGame) {
        toast.dismiss('no-matching-campaign')
      }
    })

    // Fetch initial state on mount
    window.api.bridge.getSessionState().then((state) => {
      if (state) setSession(state)
    })

    return unsub
  }, [])

  // Listen for no-matching-campaign warnings
  useEffect(() => {
    const unsub = window.api.bridge.onNoMatchingCampaign((data) => {
      toast.warning('No matching campaign', {
        id: 'no-matching-campaign',
        description: `Aurora is running "${data.gameName}" but you don't have a campaign for it. Create a new campaign to use companion features.`,
        duration: Infinity
      })
    })
    return unsub
  }, [])

  // ── Actions (all go through main process) ──────────────────

  const switchGame = useCallback(async (gameId: string) => {
    const result = await window.api.bridge.setSessionGame(gameId) as {
      accepted: boolean
      reason?: string
    } | null
    if (result && !result.accepted && result.reason) {
      toast.error('Cannot switch campaigns', {
        description: result.reason,
        duration: 5000
      })
    }
  }, [])

  const addGameMutation = useMutation({
    mutationFn: async (game: GameSession) => {
      await window.api.games.addOrUpdate(game)
      // After adding, tell main to select it
      await window.api.bridge.setSessionGame(game.id)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['games'] })
    }
  })

  const removeGameMutation = useMutation({
    mutationFn: (gameId: string) => window.api.games.remove(gameId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['games'] })
    }
  })

  const updatePersonalityMutation = useMutation({
    mutationFn: ({
      gameId,
      archetype,
      personalityName
    }: {
      gameId: string
      archetype: string
      personalityName: string
    }) => window.api.games.updatePersonality(gameId, archetype, personalityName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['games'] })
    }
  })

  const clearAllMutation = useMutation({
    mutationFn: () => window.api.games.clearAll(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['games'] })
    }
  })

  const addGame = useCallback(async (game: GameSession) => {
    await addGameMutation.mutateAsync(game)
  }, [addGameMutation])

  const removeGame = useCallback((gameId: string) => {
    removeGameMutation.mutate(gameId)
  }, [removeGameMutation])

  const updateGamePersonality = useCallback(async (archetype: string, personalityName: string) => {
    if (!session.currentGame) return
    updatePersonalityMutation.mutate({
      gameId: session.currentGame.id,
      archetype,
      personalityName
    })
  }, [session.currentGame, updatePersonalityMutation])

  const clearAll = useCallback(() => {
    clearAllMutation.mutate()
  }, [clearAllMutation])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading games...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center text-destructive">
          <p>Failed to load games</p>
          <p className="text-sm mt-2">{(error as Error).message}</p>
        </div>
      </div>
    )
  }

  return (
    <GameContext.Provider
      value={{
        currentGame: session.currentGame,
        savedGames,
        runningGameId: session.runningGameId,
        runningGameName: session.runningGameName,
        lockedCampaignId: session.lockedCampaignId,
        switchGame,
        addGame,
        removeGame,
        updateGamePersonality,
        clearAll
      }}
    >
      {children}
    </GameContext.Provider>
  )
}
