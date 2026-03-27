import { BrowserWindow } from 'electron'
import { EventEmitter } from 'events'
import type { GameSession } from '@shared/types'
import { loadGames, updateGameLastAccessed } from './game-persistence'

/**
 * Single source of truth for the current game session.
 *
 * The main process OWNS game selection. The renderer is display-only.
 * Every state change broadcasts the full state to all renderer windows.
 *
 * State shape (broadcast to renderer on every change):
 *   currentGame:      the active campaign, or null
 *   runningGameId:    Aurora's active GameID (from bridge), or null
 *   runningGameName:  Aurora's active game name, or null
 *   lockedCampaignId: the only campaign allowed while bridge is connected, or null
 */

export interface GameSessionState {
  currentGame: GameSession | null
  runningGameId: number | null
  runningGameName: string | null
  lockedCampaignId: string | null
}

class GameSessionService extends EventEmitter {
  private _currentGame: GameSession | null = null
  private _runningGameId: number | null = null
  private _runningGameName: string | null = null
  private _lockedCampaignId: string | null = null

  // ── Public getters (for main process consumers) ──────────────

  get currentGame(): GameSession | null {
    return this._currentGame
  }

  get currentGameId(): string | null {
    return this._currentGame?.id ?? null
  }

  getGameCtx(): { gameId: number; raceId: number } | null {
    if (!this._currentGame) return null
    return {
      gameId: this._currentGame.gameInfo.auroraGameId,
      raceId: this._currentGame.gameInfo.auroraRaceId
    }
  }

  getState(): GameSessionState {
    return {
      currentGame: this._currentGame,
      runningGameId: this._runningGameId,
      runningGameName: this._runningGameName,
      lockedCampaignId: this._lockedCampaignId
    }
  }

  // ── Game selection ───────────────────────────────────────────

  /**
   * Set the current game by UUID. Returns the resulting state.
   * Blocked if bridge is connected and game doesn't match.
   */
  async setCurrentGame(gameId: string | null): Promise<{ accepted: boolean; reason?: string; state: GameSessionState }> {
    if (!gameId) {
      this._currentGame = null
      this.emit('gameChanged', null)
      this.broadcastState()
      return { accepted: true, state: this.getState() }
    }

    const games = await loadGames()
    const game = games.find((g) => g.id === gameId)
    if (!game) {
      console.error(`[GameSession] Game ${gameId} not found`)
      return { accepted: false, reason: 'Game not found', state: this.getState() }
    }

    // Enforce lock
    if (this._runningGameId !== null) {
      if (this._lockedCampaignId === null) {
        const reason = `Aurora is running "${this._runningGameName}" but no campaign matches. Create a new campaign for it.`
        console.warn(`[GameSession] Blocked "${game.gameInfo.gameName}": ${reason}`)
        return { accepted: false, reason, state: this.getState() }
      }
      if (gameId !== this._lockedCampaignId) {
        const lockedGame = games.find((g) => g.id === this._lockedCampaignId)
        const reason = `Aurora is running "${lockedGame?.gameInfo.gameName ?? this._runningGameName}". Only that campaign can be active.`
        console.warn(`[GameSession] Blocked "${game.gameInfo.gameName}": ${reason}`)
        return { accepted: false, reason, state: this.getState() }
      }
    }

    this._currentGame = game
    this.emit('gameChanged', game)
    await updateGameLastAccessed(gameId)
    console.log(`[GameSession] Selected: "${game.gameInfo.gameName}" (GameID=${game.gameInfo.auroraGameId})`)
    this.broadcastState()
    return { accepted: true, state: this.getState() }
  }

  /**
   * Auto-select the most recently accessed game on startup.
   */
  async autoSelectGame(): Promise<void> {
    const games = await loadGames()
    if (games.length === 0) return
    const sorted = [...games].sort((a, b) => (b.lastAccessedAt ?? 0) - (a.lastAccessedAt ?? 0))
    await this.setCurrentGame(sorted[0].id)
  }

  // ── Bridge game detection ───────────────────────────────────

  /**
   * Detect which game Aurora is running and auto-lock.
   * Called when bridge connects or when the title bar empire name changes.
   */
  async detectAndLockRunningGame(
    queryFn: <T>(sql: string) => Promise<T[]>
  ): Promise<void> {
    try {
      const rows = await queryFn<{ GameID: number; GameName: string }>(
        'SELECT GameID, GameName FROM FCT_Game ORDER BY LastViewed DESC LIMIT 1'
      )
      if (!rows || rows.length === 0) return

      const auroraGame = rows[0]
      this._runningGameId = auroraGame.GameID
      this._runningGameName = auroraGame.GameName

      console.log(`[GameSession] Aurora running: "${auroraGame.GameName}" (ID=${auroraGame.GameID})`)

      // Find matching campaign (GameID + GameName to handle different DB installations)
      const games = await loadGames()
      const match = games.find(
        (g) =>
          g.gameInfo.auroraGameId === auroraGame.GameID &&
          g.gameInfo.gameName === auroraGame.GameName
      )

      if (match) {
        this._lockedCampaignId = match.id
        console.log(`[GameSession] Locked to: "${match.gameInfo.gameName}" (${match.id})`)

        if (this._currentGame?.id !== match.id) {
          this._currentGame = match
          this.emit('gameChanged', match)
          await updateGameLastAccessed(match.id)
        }
      } else {
        console.warn(`[GameSession] No campaign matches "${auroraGame.GameName}"`)
        this._currentGame = null
        this._lockedCampaignId = null
        this.emit('gameChanged', null)
        this.broadcast('bridge:noMatchingCampaign', { gameName: auroraGame.GameName })
      }

      this.broadcastState()
    } catch (e) {
      console.warn('[GameSession] Detection failed:', e)
    }
  }

  /**
   * Clear the running game lock (bridge disconnect).
   */
  /**
   * Clear the running game lock (bridge disconnect).
   * Keeps the current game selected — the user stays on their campaign.
   * If the bridge reconnects to a different game, detectAndLock will switch.
   */
  clearRunningGame(): void {
    this._runningGameId = null
    this._runningGameName = null
    this._lockedCampaignId = null
    // Keep _currentGame — don't kick the user out on disconnect
    console.log('[GameSession] Lock cleared (bridge disconnected), keeping current game')
    this.broadcastState()
  }

  // ── DB path validation ──────────────────────────────────────

  validateDbPath(bridgeDbPath: string | null, configuredDbPath: string | null): void {
    if (!bridgeDbPath || !configuredDbPath) return
    const normalize = (p: string): string => p.replace(/\\/g, '/').toLowerCase()
    if (normalize(bridgeDbPath) !== normalize(configuredDbPath)) {
      console.warn(`[GameSession] DB path mismatch: bridge="${bridgeDbPath}" config="${configuredDbPath}"`)
      this.broadcast('bridge:dbPathMismatch', { bridgePath: bridgeDbPath, configPath: configuredDbPath })
    }
  }

  // ── Broadcasting ────────────────────────────────────────────

  private broadcastState(): void {
    this.broadcast('gameSession:state', this.getState())
  }

  private broadcast(channel: string, data: unknown): void {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send(channel, data)
      }
    }
  }
}

export const gameSession = new GameSessionService()
