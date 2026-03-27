import { app } from 'electron'
import { join } from 'path'
import { promises as fs } from 'fs'

export interface FilterCondition {
  id: string
  field: string
  operator: string
  value: string | number
  enabled: boolean
  negate?: boolean
}

export interface FilterGroup {
  id: string
  conditions: FilterCondition[]
}

export interface FilterPreset {
  name: string
  groups: FilterGroup[]
  builtIn?: boolean
  showOnBar?: boolean
}

const FILTERS_FILE = 'fleet-filters.json'

function getFiltersFilePath(): string {
  return join(app.getPath('userData'), FILTERS_FILE)
}

export async function loadSavedFilters(): Promise<FilterPreset[]> {
  try {
    const filePath = getFiltersFilePath()
    const data = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return []
    }
    console.error('Failed to load saved filters:', error)
    return []
  }
}

export async function saveSavedFilters(filters: FilterPreset[]): Promise<void> {
  try {
    const filePath = getFiltersFilePath()
    const data = JSON.stringify(filters, null, 2)
    await fs.writeFile(filePath, data, 'utf-8')
  } catch (error) {
    console.error('Failed to save filters:', error)
    throw error
  }
}
