import { app } from 'electron'
import { join } from 'path'
import { promises as fs } from 'fs'

export interface SavedRoute {
  id: string
  name: string
  startSystemId: number
  startSystemName: string
  endSystemId: number
  endSystemName: string
  waypoints: { systemId: number; systemName: string; refuel?: boolean }[]
  classId?: number
  className?: string
  createdAt: number
}

const ROUTES_FILE = 'saved-routes.json'

function getRoutesFilePath(): string {
  return join(app.getPath('userData'), ROUTES_FILE)
}

export async function loadSavedRoutes(): Promise<SavedRoute[]> {
  try {
    const filePath = getRoutesFilePath()
    const data = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return []
    }
    console.error('Failed to load saved routes:', error)
    return []
  }
}

export async function saveSavedRoutes(routes: SavedRoute[]): Promise<void> {
  try {
    const filePath = getRoutesFilePath()
    const data = JSON.stringify(routes, null, 2)
    await fs.writeFile(filePath, data, 'utf-8')
  } catch (error) {
    console.error('Failed to save routes:', error)
    throw error
  }
}

export async function addSavedRoute(route: SavedRoute): Promise<SavedRoute[]> {
  const routes = await loadSavedRoutes()
  routes.unshift(route)
  await saveSavedRoutes(routes)
  return routes
}

export async function removeSavedRoute(routeId: string): Promise<SavedRoute[]> {
  const routes = await loadSavedRoutes()
  const filtered = routes.filter((r) => r.id !== routeId)
  await saveSavedRoutes(filtered)
  return filtered
}

export async function updateSavedRoute(
  routeId: string,
  patch: Partial<SavedRoute>
): Promise<SavedRoute[]> {
  const routes = await loadSavedRoutes()
  const idx = routes.findIndex((r) => r.id === routeId)
  if (idx !== -1) {
    routes[idx] = { ...routes[idx], ...patch }
  }
  await saveSavedRoutes(routes)
  return routes
}
