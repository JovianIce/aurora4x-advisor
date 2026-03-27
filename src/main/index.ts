import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { autoUpdater } from 'electron-updater'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import {
  getAllArchetypes,
  getArchetype,
  matchPersonality,
  loadProfile,
  loadAllProfiles,
  getObservationMessage,
  getTutorialAdvice,
  getGreeting
} from './advisor'
import type { GameState, Observation } from './advisor'
import { detectGame, listGames } from './services/game-detection'
import {
  loadGames,
  saveGames,
  addOrUpdateGame,
  removeGame,
  updateGamePersonality,
  updateGameLastAccessed,
  clearAllGames
} from './services/game-persistence'
import { loadSettings, saveSettings, updateSetting } from './services/settings-persistence'
import { dbWatcher } from './services/db-watcher'
import { gameSession } from './services/game-session'
import { analyzeGameState } from './services/game-state-analyzer'
import { auroraBridge } from './services/aurora-bridge'
import { dumpMemoryToFiles } from './services/memory-dump'
import {
  loadSavedRoutes,
  addSavedRoute,
  removeSavedRoute,
  updateSavedRoute
} from './services/route-persistence'
import type { SavedRoute } from './services/route-persistence'
import { loadSavedFilters, saveSavedFilters } from './services/filter-persistence'
import type { FilterPreset } from './services/filter-persistence'
import { dialog } from 'electron'
import * as compute from './compute'
import { formatGameDate } from './compute/utils'

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// const reactDevToolsPath = join(
//   homedir(),
//   '/Library/Application Support/Google/Chrome/Default/Extensions/fmkadmapgofadopljbjfkapdkoienihi/7.0.1_0'
// )

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.aurora4x.companion')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', async (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  // Advisor API handlers
  ipcMain.handle('advisor:getAllArchetypes', () => {
    return getAllArchetypes()
  })

  ipcMain.handle('advisor:getArchetype', (_event, id) => {
    return getArchetype(id)
  })

  ipcMain.handle('advisor:matchPersonality', (_event, archetype, ideology) => {
    return matchPersonality(archetype, ideology)
  })

  // V2 Profile API handlers
  ipcMain.handle('advisor:loadProfile', (_event, profileId: string) => {
    return loadProfile(profileId)
  })

  ipcMain.handle('advisor:loadAllProfiles', () => {
    return loadAllProfiles()
  })

  ipcMain.handle('advisor:getGreeting', (_event, profileId: string, isInitial: boolean) => {
    const profile = loadProfile(profileId)
    return getGreeting(profile, isInitial)
  })

  ipcMain.handle(
    'advisor:getObservationMessage',
    (
      _event,
      profileId: string,
      observationId: string,
      observation: Observation,
      gameState: GameState
    ) => {
      const profile = loadProfile(profileId)
      return getObservationMessage(observationId, observation, gameState, profile)
    }
  )

  ipcMain.handle('advisor:getTutorialAdvice', (_event, profileId: string, gameState: GameState) => {
    const profile = loadProfile(profileId)
    return getTutorialAdvice(gameState, profile)
  })

  // Game API handlers
  ipcMain.handle('game:listGames', async () => {
    const settings = await loadSettings()
    if (!settings.auroraDbPath) return []
    return listGames(settings.auroraDbPath)
  })

  ipcMain.handle('game:detectGame', async (_event, gameName: string) => {
    console.log('[Main] game:detectGame handler called')
    console.log(`[Main] Game name: "${gameName}"`)

    // Load settings to get Aurora DB path
    const settings = await loadSettings()
    console.log('[Main] Settings loaded:', JSON.stringify(settings, null, 2))

    if (!settings.auroraDbPath) {
      const errorMsg = 'Aurora database path not configured. Please set it in Settings.'
      console.error(`[Main] ❌ ${errorMsg}`)
      throw new Error(errorMsg)
    }

    console.log(`[Main] Using Aurora DB path: ${settings.auroraDbPath}`)
    return detectGame(gameName, settings.auroraDbPath)
  })

  // Game persistence handlers
  ipcMain.handle('games:load', () => {
    return loadGames()
  })

  ipcMain.handle('games:save', (_event, games) => {
    return saveGames(games)
  })

  ipcMain.handle('games:addOrUpdate', (_event, game) => {
    return addOrUpdateGame(game)
  })

  ipcMain.handle('games:remove', (_event, gameId: string) => {
    return removeGame(gameId)
  })

  ipcMain.handle(
    'games:updatePersonality',
    (_event, gameId: string, archetype: string, name: string) => {
      return updateGamePersonality(gameId, archetype, name)
    }
  )

  ipcMain.handle('games:updateLastAccessed', (_event, gameId: string) => {
    return updateGameLastAccessed(gameId)
  })

  ipcMain.handle('games:clearAll', () => {
    return clearAllGames()
  })

  // Settings handlers
  ipcMain.handle('settings:load', () => {
    return loadSettings()
  })

  ipcMain.handle('settings:save', (_event, settings) => {
    return saveSettings(settings)
  })

  ipcMain.handle('settings:update', (_event, key, value) => {
    return updateSetting(key, value)
  })

  // Database watcher handlers
  ipcMain.handle('dbWatcher:setPath', async (_event, dbPath: string | null) => {
    if (dbPath) {
      dbWatcher.setAuroraDbPath(dbPath)
      await updateSetting('auroraDbPath', dbPath)
    } else {
      dbWatcher.stop()
      await updateSetting('auroraDbPath', null)
    }
    return dbWatcher.getStatus()
  })

  ipcMain.handle('dbWatcher:setCurrentGame', async (_event, gameId: string | null) => {
    // Delegate to GameSessionService — single source of truth
    await gameSession.setCurrentGame(gameId)
    return dbWatcher.getStatus()
  })

  ipcMain.handle('gameSession:getState', () => {
    return gameSession.getState()
  })

  ipcMain.handle('gameSession:setCurrent', async (_event, gameId: string | null) => {
    return gameSession.setCurrentGame(gameId)
  })

  ipcMain.handle('dbWatcher:getStatus', () => {
    return dbWatcher.getStatus()
  })

  // Create initial snapshot after setup completes
  ipcMain.handle('dbWatcher:createInitialSnapshot', async () => {
    console.log('[Main] Creating initial snapshot after setup')
    try {
      await dbWatcher.createInitialSnapshot()
      console.log('[Main] ✅ Initial snapshot created')
    } catch (error) {
      console.error('[Main] ❌ Failed to create initial snapshot:', error)
      throw error
    }
  })

  // Trigger analysis using live bridge data
  ipcMain.handle(
    'advisor:triggerInitialAnalysis',
    async (_event, _dbPath: string, profileId: string) => {
      console.log('[Main] Triggering analysis from bridge data')
      console.log('[Main] Profile ID:', profileId)

      try {
        const advice = await analyzeGameState(profileId)
        if (!advice) {
          console.log('[Main] Bridge not connected — no advice available')
          return null
        }
        console.log('[Main] ✅ Analysis complete')
        console.log('[Main] Tutorials:', advice.tutorials.length)
        return advice
      } catch (error) {
        console.error('[Main] ❌ Failed to analyze game state:', error)
        throw error
      }
    }
  )

  ipcMain.handle('dbWatcher:pickFile', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select Aurora 4X Database',
      filters: [{ name: 'Database Files', extensions: ['db'] }],
      properties: ['openFile']
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    return result.filePaths[0]
  })

  // Aurora Bridge handlers
  ipcMain.handle('bridge:connect', async (_event, port?: number) => {
    auroraBridge.connect(port)
    return auroraBridge.getStatus()
  })

  ipcMain.handle('bridge:disconnect', () => {
    auroraBridge.disconnect()
    return auroraBridge.getStatus()
  })

  ipcMain.handle('bridge:reconnectNow', () => {
    auroraBridge.reconnectNow()
    return auroraBridge.getStatus()
  })

  ipcMain.handle('bridge:getLastTitleBar', () => {
    return auroraBridge.lastTitleBarText
  })

  ipcMain.handle('bridge:getActiveEmpire', () => {
    return auroraBridge.activeEmpireName
  })

  ipcMain.handle('bridge:getStatus', () => {
    return auroraBridge.getStatus()
  })

  ipcMain.handle('bridge:query', async (_event, sql: string) => {
    return auroraBridge.query(sql)
  })

  ipcMain.handle('bridge:queryFull', async (_event, sql: string) => {
    return auroraBridge.queryFull(sql)
  })

  ipcMain.handle('bridge:getTableMapping', async () => {
    return auroraBridge.getTableMapping()
  })

  ipcMain.handle('bridge:rediscoverMapping', async () => {
    return auroraBridge.rediscoverMapping()
  })

  ipcMain.handle('bridge:getTableInfo', async (_event, tableName: string) => {
    return auroraBridge.queryFull(`PRAGMA table_info(${tableName})`)
  })

  ipcMain.handle('bridge:getAllTables', async () => {
    const tables = await auroraBridge.queryFull<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    )
    const results: { name: string; rows: number }[] = []
    for (const t of tables) {
      try {
        const count = await auroraBridge.queryFull<{ cnt: number }>(
          `SELECT COUNT(*) as cnt FROM "${t.name}"`
        )
        results.push({ name: t.name, rows: count[0]?.cnt ?? 0 })
      } catch {
        results.push({ name: t.name, rows: -1 })
      }
    }
    return results
  })

  ipcMain.handle('bridge:subscribeBodies', async (_event, systemId: number | null) => {
    return auroraBridge.subscribeBodies(systemId)
  })

  ipcMain.handle('bridge:getBodies', async (_event, systemId?: number) => {
    return auroraBridge.getBodies(systemId)
  })

  ipcMain.handle('bridge:getKnownSystems', async () => {
    return auroraBridge.getKnownSystems()
  })

  ipcMain.handle('bridge:getFleets', async () => {
    return auroraBridge.getFleets()
  })

  ipcMain.handle('bridge:executeAction', async (_event, action) => {
    return auroraBridge.executeAction(action)
  })

  ipcMain.handle('bridge:dumpMemory', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select folder for memory dump',
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return null

    const outputDir = result.filePaths[0]
    return dumpMemoryToFiles(outputDir)
  })

  ipcMain.handle('bridge:enumerateGameState', async () => {
    return auroraBridge.enumerateGameState()
  })

  ipcMain.handle('bridge:enumerateCollections', async () => {
    return auroraBridge.enumerateCollections()
  })

  ipcMain.handle('bridge:readCollection', async (_event, params) => {
    return auroraBridge.readCollection(params)
  })

  // Operations compute handlers — resolve GameCtx from GameSessionService
  const bridgeQuery: compute.QueryFn = <T = Record<string, unknown>>(sql: string) =>
    auroraBridge.query<T>(sql)

  function getGameCtx(): compute.GameCtx {
    const ctx = gameSession.getGameCtx()
    if (!ctx) throw new Error('No game selected')
    return ctx
  }

  ipcMain.handle('ops:getShips', async () => {
    const ctx = await getGameCtx()
    return compute.getShips(bridgeQuery, ctx)
  })

  ipcMain.handle('ops:getClasses', async () => {
    const ctx = await getGameCtx()
    return compute.getShipClasses(bridgeQuery, ctx)
  })

  ipcMain.handle('ops:getClassDetail', async (_event, classId: number) => {
    const ctx = await getGameCtx()
    return compute.getShipClassDetail(bridgeQuery, ctx, classId)
  })

  ipcMain.handle('ops:computeRoute', async (_event, req: compute.RouteRequest) => {
    const ctx = await getGameCtx()
    return compute.computeRoute(bridgeQuery, ctx, req)
  })

  ipcMain.handle('ops:computeFleetRoute', async (_event, req: compute.FleetRouteRequest) => {
    const ctx = await getGameCtx()
    return compute.computeFleetRoute(bridgeQuery, ctx, req)
  })

  ipcMain.handle('ops:getWaypoints', async () => {
    const ctx = await getGameCtx()
    return compute.getWaypoints(bridgeQuery, ctx)
  })

  ipcMain.handle('ops:getFleets', async () => {
    const ctx = await getGameCtx()
    return compute.getFleets(bridgeQuery, ctx)
  })

  ipcMain.handle('ops:getMineralTotals', async () => {
    const ctx = await getGameCtx()
    return compute.getMineralTotals(bridgeQuery, ctx)
  })

  ipcMain.handle(
    'ops:getMineralHistory',
    async (_event, resolution?: compute.Resolution, populationId?: number | null) => {
      const ctx = await getGameCtx()
      return compute.getMineralHistory(bridgeQuery, ctx, resolution, populationId)
    }
  )

  ipcMain.handle(
    'ops:getMineralBreakdown',
    async (_event, mineralId: number, resolution?: compute.Resolution) => {
      const ctx = await getGameCtx()
      return compute.getMineralBreakdown(bridgeQuery, ctx, mineralId, resolution)
    }
  )

  ipcMain.handle('ops:getMineralColonies', async () => {
    const ctx = await getGameCtx()
    return compute.getMineralColonies(bridgeQuery, ctx)
  })

  ipcMain.handle('ops:getGameDate', async () => {
    const ctx = await getGameCtx()
    const rows = await bridgeQuery<{ GameTime: number; StartYear: number }>(
      `SELECT GameTime, StartYear FROM FCT_Game WHERE GameID = ${ctx.gameId}`
    )
    if (rows.length === 0) return null
    const { GameTime, StartYear } = rows[0]
    const totalDays = GameTime / 86400
    const yearsElapsed = Math.floor(totalDays / 365.25)
    const remainingDays = totalDays - yearsElapsed * 365.25
    const year = StartYear + yearsElapsed
    const month = Math.floor(remainingDays / 30.44) + 1
    const day = Math.floor(remainingDays % 30.44) + 1
    const hours = Math.floor((GameTime % 86400) / 3600)
    const minutes = Math.floor((GameTime % 3600) / 60)
    const seconds = Math.floor(GameTime % 60)
    return {
      gameTime: GameTime,
      startYear: StartYear,
      year,
      month,
      day,
      hours,
      minutes,
      seconds,
      formatted: formatGameDate(GameTime, StartYear)
    }
  })

  ipcMain.handle('ops:getResearchOverview', async () => {
    const ctx = await getGameCtx()
    return compute.getResearchOverview(bridgeQuery, ctx)
  })

  // Saved routes persistence
  ipcMain.handle('routes:load', async () => {
    return loadSavedRoutes()
  })

  ipcMain.handle('routes:add', async (_event, route: SavedRoute) => {
    return addSavedRoute(route)
  })

  ipcMain.handle('routes:remove', async (_event, routeId: string) => {
    return removeSavedRoute(routeId)
  })

  ipcMain.handle('routes:update', async (_event, routeId: string, patch: Partial<SavedRoute>) => {
    return updateSavedRoute(routeId, patch)
  })

  // Saved filters persistence
  ipcMain.handle('fleetFilters:load', async () => {
    return loadSavedFilters()
  })

  ipcMain.handle('fleetFilters:save', async (_event, fleetFilters: FilterPreset[]) => {
    return saveSavedFilters(fleetFilters)
  })

  // Initialize database watcher from settings
  loadSettings().then(async (settings) => {
    if (settings.auroraDbPath && settings.watchEnabled) {
      dbWatcher.setAuroraDbPath(settings.auroraDbPath)
      console.log('Database watcher initialized from settings')
    }

    // Propagate game changes to dbWatcher
    gameSession.on('gameChanged', (game) => {
      dbWatcher.setCurrentGame(game?.id ?? null)
    })

    // Auto-select most recent game on startup
    await gameSession.autoSelectGame()

    // Always try to connect the bridge
    auroraBridge.connect(settings.bridgePort || 47842)
    console.log('Aurora bridge connecting...')

    // Detect Aurora's running game and auto-lock after bridge connects.
    // Re-validates when the empire name changes (player switched games in Aurora).
    let lastEmpireName: string | null = null
    let validationPending = false

    const runValidation = (): void => {
      if (validationPending || !auroraBridge.isConnected) return
      validationPending = true

      setTimeout(async () => {
        validationPending = false

        // Check DB path mismatch (only on first connect)
        if (!lastEmpireName) {
          gameSession.validateDbPath(auroraBridge.auroraDbPath, settings.auroraDbPath)
        }

        // Detect running game, auto-select matching campaign, lock selection
        await gameSession.detectAndLockRunningGame((sql) => auroraBridge.query(sql))
      }, 2000)
    }

    auroraBridge.onPush(() => {
      if (!auroraBridge.isConnected) return

      const currentEmpire = auroraBridge.activeEmpireName
      if (!currentEmpire) return

      if (lastEmpireName && currentEmpire !== lastEmpireName) {
        // Empire actually changed (user switched games in Aurora)
        console.log(`[Main] Empire changed: "${lastEmpireName}" → "${currentEmpire}"`)
        lastEmpireName = currentEmpire
        gameSession.clearRunningGame()
        runValidation()
      } else if (!lastEmpireName) {
        // First push after connect/reconnect — just validate, don't clear
        console.log(`[Main] Bridge connected, empire: "${currentEmpire}"`)
        lastEmpireName = currentEmpire
        runValidation()
      }
    })

    // Clear lock on disconnect so user can freely browse campaigns while offline
    auroraBridge.onPush(() => {
      if (!auroraBridge.isConnected && lastEmpireName) {
        lastEmpireName = null
        gameSession.clearRunningGame()
      }
    })

    // Re-analyze on bridge push (game tick) — throttled to at most once per 5 seconds
    let lastAnalysis = 0
    auroraBridge.onPush(async () => {
      const now = Date.now()
      if (now - lastAnalysis < 5000) return
      lastAnalysis = now

      const game = gameSession.currentGame
      if (!game?.personalityArchetype) return

      const profiles = await import('./advisor').then((m) => m.loadAllProfiles())
      const profile = profiles.find((p) => p.archetype === game.personalityArchetype)
      if (!profile) return

      try {
        const advice = await analyzeGameState(profile.id)
        if (advice) {
          for (const win of BrowserWindow.getAllWindows()) {
            if (!win.isDestroyed()) {
              win.webContents.send('advisor:adviceUpdate', advice)
            }
          }
        }
      } catch (err) {
        console.warn('[Main] Push-triggered analysis failed:', err)
      }
    })
  })

  createWindow()

  // Check for updates (non-blocking, logs only in dev)
  if (!is.dev) {
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.checkForUpdatesAndNotify().catch((err) => {
      console.log('[AutoUpdate] Check failed:', err?.message)
    })
  }

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Cleanup on quit
app.on('before-quit', () => {
  dbWatcher.stop()
  auroraBridge.disconnect()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
