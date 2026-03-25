import { watch, FSWatcher } from 'fs'
import { copyFile, mkdir } from 'fs/promises'
import { app } from 'electron'
import path from 'path'
import Database from 'better-sqlite3'
import { loadGames } from './game-persistence'

/**
 * Database Watcher Service
 *
 * Monitors the Aurora 4X database file for changes and creates snapshots
 * when changes are detected. Snapshots are stored per-game to allow
 * tracking game progress over time.
 */

export class DatabaseWatcher {
  private watcher: FSWatcher | null = null
  private auroraDbPath: string | null = null
  private currentGameId: string | null = null
  private isProcessing = false
  private onSnapshotCreated?: (snapshotPath: string) => void

  /**
   * Set the path to the Aurora database file to watch
   */
  setAuroraDbPath(dbPath: string): void {
    console.log('[DB Watcher] Setting Aurora DB path:', dbPath)

    if (this.auroraDbPath === dbPath) {
      console.log('[DB Watcher] Path unchanged, skipping')
      return
    }

    // Stop watching previous path
    this.stop()

    this.auroraDbPath = dbPath
    console.log('[DB Watcher] Aurora DB path updated')
    this.start()
  }

  /**
   * Set the current game - this determines which folder to save snapshots to
   * @param gameId - UUID for the game session
   */
  setCurrentGame(gameId: string | null): void {
    console.log('[DB Watcher] Setting current game ID:', gameId)
    this.currentGameId = gameId

    if (gameId) {
      console.log('[DB Watcher] Game selected - snapshots will be created on DB changes')
    } else {
      console.log('[DB Watcher] No game selected - snapshots will NOT be created')
    }
  }

  /**
   * Set callback for when a snapshot is created
   */
  onSnapshot(callback: (snapshotPath: string) => void): void {
    this.onSnapshotCreated = callback
  }

  /**
   * Start watching the Aurora database file
   */
  private start(): void {
    if (!this.auroraDbPath) {
      console.warn('[DB Watcher] Cannot start watcher: Aurora DB path not set')
      return
    }

    try {
      console.log(`[DB Watcher] Starting file watcher for: ${this.auroraDbPath}`)

      this.watcher = watch(this.auroraDbPath, async (eventType) => {
        console.log(`[DB Watcher] File event detected: ${eventType}`)
        if (eventType === 'change') {
          await this.handleDatabaseChange()
        }
      })

      this.watcher.on('error', (error) => {
        console.error('[DB Watcher] File watcher error:', error)
      })

      console.log('[DB Watcher] File watcher started successfully')
    } catch (error) {
      console.error('[DB Watcher] Failed to start file watcher:', error)
    }
  }

  /**
   * Stop watching the database file
   */
  stop(): void {
    if (this.watcher) {
      console.log('[DB Watcher] Stopping file watcher')
      this.watcher.close()
      this.watcher = null
      console.log('[DB Watcher] File watcher stopped')
    } else {
      console.log('[DB Watcher] No active watcher to stop')
    }
  }

  /**
   * Create an initial snapshot immediately (for after setup completes)
   */
  async createInitialSnapshot(): Promise<void> {
    console.log('[DB Watcher] ========================================')
    console.log('[DB Watcher] Creating initial snapshot...')
    console.log('[DB Watcher] ========================================')

    if (!this.currentGameId) {
      console.log('[DB Watcher] ⚠️  No active game selected - cannot create snapshot')
      return
    }

    if (!this.auroraDbPath) {
      console.error('[DB Watcher] ❌ Database path not set')
      return
    }

    console.log('[DB Watcher] Active game ID:', this.currentGameId)

    try {
      // Create snapshot
      const snapshotPath = await this.createSnapshot(this.currentGameId, this.auroraDbPath)
      console.log('[DB Watcher] ✅ Initial snapshot created successfully!')
      console.log('[DB Watcher] Snapshot path:', snapshotPath)

      // Notify listeners
      if (this.onSnapshotCreated) {
        this.onSnapshotCreated(snapshotPath)
      }
      console.log('[DB Watcher] ✅ Initial snapshot created (analysis is bridge-driven now)')
    } catch (error) {
      console.error('[DB Watcher] ❌ Failed to create initial snapshot:', error)
      if (error instanceof Error) {
        console.error('[DB Watcher] Error details:', error.message)
      }
      throw error // Re-throw so caller knows it failed
    }
  }

  /**
   * Handle database file change event
   */
  private async handleDatabaseChange(): Promise<void> {
    console.log('[DB Watcher] ========================================')
    console.log('[DB Watcher] Database file change detected!')
    console.log('[DB Watcher] ========================================')

    // Prevent concurrent processing
    if (this.isProcessing) {
      console.log('[DB Watcher] Already processing a change, skipping...')
      return
    }

    // Only create snapshots if we know which game is active
    if (!this.currentGameId) {
      console.log('[DB Watcher] ⚠️  No active game selected - skipping snapshot')
      console.log('[DB Watcher] Please select a game in the sidebar before saving')
      return
    }

    if (!this.auroraDbPath) {
      console.error('[DB Watcher] ❌ Database path not set (this should not happen)')
      return
    }

    console.log('[DB Watcher] Active game ID:', this.currentGameId)
    console.log('[DB Watcher] Starting snapshot creation...')

    this.isProcessing = true

    try {
      // Create snapshot
      const snapshotPath = await this.createSnapshot(this.currentGameId, this.auroraDbPath)
      console.log('[DB Watcher] ✅ Snapshot created successfully!')
      console.log('[DB Watcher] Snapshot path:', snapshotPath)

      // Notify listeners
      if (this.onSnapshotCreated) {
        this.onSnapshotCreated(snapshotPath)
      }
      console.log('[DB Watcher] ✅ Snapshot created (analysis is bridge-driven now)')
    } catch (error) {
      console.error('[DB Watcher] ❌ Failed to create snapshot:', error)
      if (error instanceof Error) {
        console.error('[DB Watcher] Error details:', error.message)
      }
    } finally {
      // Add a small delay before allowing next snapshot to prevent rapid-fire saves
      console.log('[DB Watcher] Cooldown period: 2 seconds before next snapshot allowed')
      setTimeout(() => {
        this.isProcessing = false
        console.log('[DB Watcher] Ready for next snapshot')
      }, 2000)
    }
  }

  /**
   * Get current in-game year from Aurora database
   * @throws Error if game not found in database
   */
  private getGameYear(dbPath: string, gameName: string): number {
    console.log(`[DB Watcher] Querying in-game year for: "${gameName}"`)
    let db: Database.Database | null = null
    try {
      db = new Database(dbPath, { readonly: true })

      // Query current game time and start year
      const gameQuery = db.prepare(`
        SELECT GameTime, StartYear
        FROM FCT_Game
        WHERE GameName = ?
      `)
      const gameRow = gameQuery.get(gameName) as { GameTime: number; StartYear: number } | undefined

      if (!gameRow) {
        console.error(`[DB Watcher] ❌ Game "${gameName}" not found in Aurora database`)
        throw new Error(`Game "${gameName}" not found in Aurora database`)
      }

      // GameTime is in seconds, convert to years and add to start year
      // Convert seconds -> days -> years (using 365-day years)
      const gameDays = gameRow.GameTime / 86400 // seconds per day
      const gameYears = Math.floor(gameDays / 365)
      const currentYear = gameRow.StartYear + gameYears

      console.log(
        `[DB Watcher] Game time: ${gameRow.GameTime} seconds (${gameDays.toFixed(1)} days)`
      )
      console.log(`[DB Watcher] Start year: ${gameRow.StartYear}`)
      console.log(`[DB Watcher] Current year: ${currentYear}`)

      return currentYear
    } finally {
      if (db) {
        db.close()
      }
    }
  }

  /**
   * Get game name from gameId by loading saved games
   */
  private async getGameName(gameId: string): Promise<string | null> {
    console.log(`[DB Watcher] Looking up game name for ID: ${gameId}`)
    try {
      const games = await loadGames()
      console.log(`[DB Watcher] Loaded ${games.length} saved game(s)`)
      const game = games.find((g) => g.id === gameId)

      if (game) {
        console.log(`[DB Watcher] Found game: "${game.gameInfo.gameName}"`)
        return game.gameInfo.gameName
      } else {
        console.error(`[DB Watcher] ❌ Game ID "${gameId}" not found in saved games`)
        return null
      }
    } catch (error) {
      console.error('[DB Watcher] ❌ Failed to load game name:', error)
      return null
    }
  }

  /**
   * Create a snapshot of the Aurora database for a specific game
   */
  private async createSnapshot(gameId: string, sourcePath: string): Promise<string> {
    console.log('[DB Watcher] --- Creating Snapshot ---')

    // Get game name from gameId
    const gameName = await this.getGameName(gameId)

    if (!gameName) {
      console.error('[DB Watcher] ❌ Cannot create snapshot: failed to get game name')
      throw new Error('Failed to get game name for snapshot')
    }

    // Get app data directory
    // Structure: userData/games/<game-name>/<game-name>-<year>.db
    const userDataPath = app.getPath('userData')
    const gameFolderPath = path.join(userDataPath, 'games', gameName)

    console.log(`[DB Watcher] User data path: ${userDataPath}`)
    console.log(`[DB Watcher] Snapshot folder: ${gameFolderPath}`)

    // Ensure directory exists
    console.log('[DB Watcher] Creating snapshot folder (if needed)...')
    await mkdir(gameFolderPath, { recursive: true })

    // Get in-game year for filename
    const gameYear = this.getGameYear(sourcePath, gameName)
    const snapshotFilename = `${gameName}-${gameYear}.db`
    const snapshotPath = path.join(gameFolderPath, snapshotFilename)

    console.log(`[DB Watcher] Snapshot filename: ${snapshotFilename}`)
    console.log(`[DB Watcher] Full snapshot path: ${snapshotPath}`)

    // Copy the database file
    console.log(`[DB Watcher] Copying database file...`)
    console.log(`[DB Watcher] Source: ${sourcePath}`)
    console.log(`[DB Watcher] Destination: ${snapshotPath}`)
    await copyFile(sourcePath, snapshotPath)
    console.log('[DB Watcher] File copied successfully')

    return snapshotPath
  }

  /**
   * Get the path where snapshots are stored for a game
   * Returns null if game name cannot be determined
   */
  async getSnapshotsPath(gameId: string): Promise<string | null> {
    const gameName = await this.getGameName(gameId)
    if (!gameName) {
      return null
    }
    const userDataPath = app.getPath('userData')
    return path.join(userDataPath, 'games', gameName)
  }

  /**
   * Get current watcher status
   */
  getStatus(): {
    isWatching: boolean
    auroraDbPath: string | null
    currentGameId: string | null
  } {
    return {
      isWatching: this.watcher !== null,
      auroraDbPath: this.auroraDbPath,
      currentGameId: this.currentGameId
    }
  }
}

// Singleton instance
export const dbWatcher = new DatabaseWatcher()
