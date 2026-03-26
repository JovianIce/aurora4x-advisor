import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  advisor: {
    getAllArchetypes: () => ipcRenderer.invoke('advisor:getAllArchetypes'),
    getArchetype: (id: string) => ipcRenderer.invoke('advisor:getArchetype', id),
    matchPersonality: (archetype: string, ideology: unknown) =>
      ipcRenderer.invoke('advisor:matchPersonality', archetype, ideology),
    // V2 Profile API
    loadProfile: (profileId: string) => ipcRenderer.invoke('advisor:loadProfile', profileId),
    loadAllProfiles: () => ipcRenderer.invoke('advisor:loadAllProfiles'),
    getGreeting: (profileId: string, isInitial: boolean) =>
      ipcRenderer.invoke('advisor:getGreeting', profileId, isInitial),
    getObservationMessage: (
      profileId: string,
      observationId: string,
      observation: unknown,
      gameState: unknown
    ) =>
      ipcRenderer.invoke(
        'advisor:getObservationMessage',
        profileId,
        observationId,
        observation,
        gameState
      ),
    getTutorialAdvice: (profileId: string, gameState: unknown) =>
      ipcRenderer.invoke('advisor:getTutorialAdvice', profileId, gameState),
    triggerInitialAnalysis: (dbPath: string, profileId: string) =>
      ipcRenderer.invoke('advisor:triggerInitialAnalysis', dbPath, profileId),
    onAdviceUpdate: (callback: (advice: unknown) => void): (() => void) => {
      const subscription = (_event: IpcRendererEvent, advice: unknown): void => callback(advice)
      ipcRenderer.on('advisor:adviceUpdate', subscription)
      return (): void => {
        ipcRenderer.removeListener('advisor:adviceUpdate', subscription)
      }
    }
  },
  game: {
    listGames: () => ipcRenderer.invoke('game:listGames'),
    detectGame: (gameName: string) => ipcRenderer.invoke('game:detectGame', gameName)
  },
  games: {
    load: () => ipcRenderer.invoke('games:load'),
    save: (games: unknown) => ipcRenderer.invoke('games:save', games),
    addOrUpdate: (game: unknown) => ipcRenderer.invoke('games:addOrUpdate', game),
    remove: (gameId: string) => ipcRenderer.invoke('games:remove', gameId),
    updatePersonality: (gameId: string, archetype: string, name: string) =>
      ipcRenderer.invoke('games:updatePersonality', gameId, archetype, name),
    updateLastAccessed: (gameId: string) => ipcRenderer.invoke('games:updateLastAccessed', gameId),
    clearAll: () => ipcRenderer.invoke('games:clearAll')
  },
  settings: {
    load: () => ipcRenderer.invoke('settings:load'),
    save: (settings: unknown) => ipcRenderer.invoke('settings:save', settings),
    update: (key: string, value: unknown) => ipcRenderer.invoke('settings:update', key, value)
  },
  dbWatcher: {
    setPath: (dbPath: string | null) => ipcRenderer.invoke('dbWatcher:setPath', dbPath),
    setCurrentGame: (gameId: string | null) =>
      ipcRenderer.invoke('dbWatcher:setCurrentGame', gameId),
    getStatus: () => ipcRenderer.invoke('dbWatcher:getStatus'),
    pickFile: () => ipcRenderer.invoke('dbWatcher:pickFile'),
    createInitialSnapshot: () => ipcRenderer.invoke('dbWatcher:createInitialSnapshot')
  },
  bridge: {
    connect: (port?: number) => ipcRenderer.invoke('bridge:connect', port),
    disconnect: () => ipcRenderer.invoke('bridge:disconnect'),
    reconnectNow: () => ipcRenderer.invoke('bridge:reconnectNow'),
    getStatus: () => ipcRenderer.invoke('bridge:getStatus'),
    onConnected: (callback: () => void): (() => void) => {
      const subscription = (): void => callback()
      ipcRenderer.on('bridge:connected', subscription)
      return (): void => {
        ipcRenderer.removeListener('bridge:connected', subscription)
      }
    },
    onDisconnected: (callback: () => void): (() => void) => {
      const subscription = (): void => callback()
      ipcRenderer.on('bridge:disconnected', subscription)
      return (): void => {
        ipcRenderer.removeListener('bridge:disconnected', subscription)
      }
    },
    onVersionMismatch: (
      callback: (data: { bridgeVersion: number; appVersion: number }) => void
    ): (() => void) => {
      const subscription = (
        _event: IpcRendererEvent,
        data: { bridgeVersion: number; appVersion: number }
      ): void => callback(data)
      ipcRenderer.on('bridge:versionMismatch', subscription)
      return (): void => {
        ipcRenderer.removeListener('bridge:versionMismatch', subscription)
      }
    },
    // Real-time memory data
    subscribeBodies: (systemId: number | null) =>
      ipcRenderer.invoke('bridge:subscribeBodies', systemId),
    getBodies: (systemId?: number) => ipcRenderer.invoke('bridge:getBodies', systemId),
    getKnownSystems: () => ipcRenderer.invoke('bridge:getKnownSystems'),
    getFleets: () => ipcRenderer.invoke('bridge:getFleets'),
    // SQL + actions
    query: (sql: string) => ipcRenderer.invoke('bridge:query', sql),
    getAllTables: () => ipcRenderer.invoke('bridge:getAllTables'),
    getTableInfo: (tableName: string) => ipcRenderer.invoke('bridge:getTableInfo', tableName),
    executeAction: (action: unknown) => ipcRenderer.invoke('bridge:executeAction', action),
    // Dev tools
    dumpMemory: () => ipcRenderer.invoke('bridge:dumpMemory'),
    enumerateGameState: () => ipcRenderer.invoke('bridge:enumerateGameState'),
    enumerateCollections: () => ipcRenderer.invoke('bridge:enumerateCollections'),
    readCollection: (params: {
      Field: string
      Offset?: number
      Limit?: number
      Fields?: string[]
      IncludeRefs?: boolean
      FilterField?: string
      FilterValue?: string
    }) => ipcRenderer.invoke('bridge:readCollection', params),
    onPush: (callback: (data: unknown) => void): (() => void) => {
      const subscription = (_event: IpcRendererEvent, data: unknown): void => callback(data)
      ipcRenderer.on('bridge:push', subscription)
      return (): void => {
        ipcRenderer.removeListener('bridge:push', subscription)
      }
    }
  },
  ops: {
    getShips: () => ipcRenderer.invoke('ops:getShips'),
    getClasses: () => ipcRenderer.invoke('ops:getClasses'),
    getClassDetail: (classId: number) => ipcRenderer.invoke('ops:getClassDetail', classId),
    computeRoute: (req: unknown) => ipcRenderer.invoke('ops:computeRoute', req),
    computeFleetRoute: (req: unknown) => ipcRenderer.invoke('ops:computeFleetRoute', req),
    getWaypoints: () => ipcRenderer.invoke('ops:getWaypoints'),
    getFleets: () => ipcRenderer.invoke('ops:getFleets'),
    getMineralTotals: () => ipcRenderer.invoke('ops:getMineralTotals'),
    getMineralHistory: (resolution?: string, populationId?: number | null) =>
      ipcRenderer.invoke('ops:getMineralHistory', resolution, populationId),
    getMineralBreakdown: (mineralId: number, resolution?: string) =>
      ipcRenderer.invoke('ops:getMineralBreakdown', mineralId, resolution),
    getMineralColonies: () => ipcRenderer.invoke('ops:getMineralColonies'),
    getGameDate: () => ipcRenderer.invoke('ops:getGameDate'),
    getResearchOverview: () => ipcRenderer.invoke('ops:getResearchOverview')
  },
  fleetFilters: {
    load: () => ipcRenderer.invoke('fleetFilters:load'),
    save: (fleetFilters: unknown) => ipcRenderer.invoke('fleetFilters:save', fleetFilters)
  },
  routes: {
    load: () => ipcRenderer.invoke('routes:load'),
    add: (route: unknown) => ipcRenderer.invoke('routes:add', route),
    remove: (routeId: string) => ipcRenderer.invoke('routes:remove', routeId),
    update: (routeId: string, patch: unknown) => ipcRenderer.invoke('routes:update', routeId, patch)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
