import { app } from 'electron'
import { readFile, writeFile, mkdir } from 'fs/promises'
import path from 'path'
import type { AppSettings } from '@shared/types'

const SETTINGS_FILE = 'settings.json'

const DEFAULT_SETTINGS: AppSettings = {
  auroraDbPath: null,
  watchEnabled: true,
  bridgeEnabled: false,
  bridgePort: 47842,
  enableTimeControls: false,
  enableDevTools: false
}

/**
 * Get the path to the settings file
 */
function getSettingsPath(): string {
  const userDataPath = app.getPath('userData')
  const settingsPath = path.join(userDataPath, SETTINGS_FILE)
  console.log(`[Settings] Settings file path: ${settingsPath}`)
  return settingsPath
}

/**
 * Load app settings from disk
 */
export async function loadSettings(): Promise<AppSettings> {
  console.log('[Settings] ========================================')
  console.log('[Settings] Loading settings from disk')
  console.log('[Settings] ========================================')

  try {
    const settingsPath = getSettingsPath()
    console.log('[Settings] Reading settings file...')
    const data = await readFile(settingsPath, 'utf-8')
    console.log('[Settings] ✅ Settings file read successfully')
    console.log('[Settings] File contents:', data)

    console.log('[Settings] Parsing JSON...')
    const settings = JSON.parse(data) as AppSettings
    console.log('[Settings] ✅ JSON parsed successfully')

    // Merge with defaults to ensure all fields exist
    const mergedSettings = {
      ...DEFAULT_SETTINGS,
      ...settings
    }
    console.log('[Settings] Merged settings:', JSON.stringify(mergedSettings, null, 2))
    console.log('[Settings] ✅ Settings loaded successfully')

    return mergedSettings
  } catch (error) {
    // If file doesn't exist or is invalid, return defaults
    console.log('[Settings] ⚠️  Settings file not found or invalid, using defaults')
    if (error instanceof Error) {
      console.log('[Settings] Error:', error.message)
    }
    console.log('[Settings] Default settings:', JSON.stringify(DEFAULT_SETTINGS, null, 2))
    return DEFAULT_SETTINGS
  }
}

/**
 * Save app settings to disk
 */
export async function saveSettings(settings: AppSettings): Promise<void> {
  console.log('[Settings] ========================================')
  console.log('[Settings] Saving settings to disk')
  console.log('[Settings] ========================================')
  console.log('[Settings] Settings to save:', JSON.stringify(settings, null, 2))

  try {
    const settingsPath = getSettingsPath()
    const userDataPath = app.getPath('userData')
    console.log(`[Settings] User data path: ${userDataPath}`)

    // Ensure directory exists
    console.log('[Settings] Ensuring user data directory exists...')
    await mkdir(userDataPath, { recursive: true })
    console.log('[Settings] ✅ Directory ready')

    // Write settings
    console.log('[Settings] Writing settings to file...')
    const jsonData = JSON.stringify(settings, null, 2)
    console.log('[Settings] JSON data to write:', jsonData)
    await writeFile(settingsPath, jsonData, 'utf-8')
    console.log('[Settings] ✅ Settings saved successfully')
    console.log(`[Settings] File location: ${settingsPath}`)
  } catch (error) {
    console.error('[Settings] ========================================')
    console.error('[Settings] ❌ Failed to save settings')
    console.error('[Settings] ========================================')
    console.error('[Settings] Error:', error)
    if (error instanceof Error) {
      console.error('[Settings] Error message:', error.message)
      console.error('[Settings] Error stack:', error.stack)
    }
    throw new Error('Failed to save settings')
  }
}

/**
 * Update specific setting value
 */
export async function updateSetting<K extends keyof AppSettings>(
  key: K,
  value: AppSettings[K]
): Promise<AppSettings> {
  console.log('[Settings] ========================================')
  console.log('[Settings] Updating specific setting')
  console.log('[Settings] ========================================')
  console.log(`[Settings] Key: "${key}"`)
  console.log(`[Settings] Value: ${JSON.stringify(value)}`)

  console.log('[Settings] Loading current settings...')
  const settings = await loadSettings()

  console.log(`[Settings] Updating "${key}" in settings object...`)
  settings[key] = value
  console.log('[Settings] Updated settings:', JSON.stringify(settings, null, 2))

  console.log('[Settings] Saving updated settings...')
  await saveSettings(settings)
  console.log('[Settings] ✅ Setting updated successfully')

  return settings
}
