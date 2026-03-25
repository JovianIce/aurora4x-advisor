import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'

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
import { detectGame } from './services/game-detection'
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
import { analyzeGameState } from './services/game-state-analyzer'
import { auroraBridge } from './services/aurora-bridge'
import { dumpMemoryToFiles } from './services/memory-dump'
import { dialog } from 'electron'

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
  electronApp.setAppUserModelId('com.electron')

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
    dbWatcher.setCurrentGame(gameId)
    return dbWatcher.getStatus()
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

  ipcMain.handle('bridge:getStatus', () => {
    return auroraBridge.getStatus()
  })

  ipcMain.handle('bridge:query', async (_event, sql: string) => {
    return auroraBridge.query(sql)
  })

  ipcMain.handle('bridge:getTableInfo', async (_event, tableName: string) => {
    return auroraBridge.query(`PRAGMA table_info(${tableName})`)
  })

  ipcMain.handle('bridge:getAllTables', async () => {
    const tables = await auroraBridge.query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    )
    const results: { name: string; rows: number }[] = []
    for (const t of tables) {
      try {
        const count = await auroraBridge.query<{ cnt: number }>(
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

  // Initialize database watcher from settings
  loadSettings().then((settings) => {
    if (settings.auroraDbPath && settings.watchEnabled) {
      dbWatcher.setAuroraDbPath(settings.auroraDbPath)
      console.log('Database watcher initialized from settings')
    }

    // Always try to connect the bridge
    auroraBridge.connect(settings.bridgePort || 47842)
    console.log('Aurora bridge connecting...')

    // Re-analyze on bridge push (game tick) — throttled to at most once per 5 seconds
    let lastAnalysis = 0
    auroraBridge.onPush(async () => {
      const now = Date.now()
      if (now - lastAnalysis < 5000) return
      lastAnalysis = now

      // Find current game's profile
      const games = await import('./services/game-persistence').then((m) => m.loadGames())
      const currentGameId = dbWatcher.getStatus().currentGameId
      if (!currentGameId) return

      const game = games.find((g) => g.id === currentGameId)
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
