import { createContext } from 'react'
import type { GameSession } from '../../../shared/types'

export interface GameContextState {
  // State (read-only, owned by main process)
  currentGame: GameSession | null
  savedGames: GameSession[]
  runningGameId: number | null
  runningGameName: string | null
  lockedCampaignId: string | null

  // Actions (send to main process, which validates and broadcasts result)
  switchGame: (gameId: string) => void | Promise<void>
  addGame: (game: GameSession) => void
  removeGame: (gameId: string) => void
  updateGamePersonality: (archetype: string, personalityName: string) => void
  clearAll: () => void
}

const initialState: GameContextState = {
  currentGame: null,
  savedGames: [],
  runningGameId: null,
  runningGameName: null,
  lockedCampaignId: null,
  switchGame: () => {},
  addGame: () => {},
  removeGame: () => {},
  updateGamePersonality: () => {},
  clearAll: () => {}
}

export const GameContext = createContext<GameContextState>(initialState)
