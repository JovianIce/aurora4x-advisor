/**
 * Game State Analyzer
 *
 * Analyzes live game state from the Aurora bridge (real-time memory data)
 * and calculates which tutorials and advice apply.
 */

import type { GameState, TutorialAdvice, Observation } from '../advisor/profiles/types'
import { getTutorialAdvice, loadProfile, getObservationMessage } from '../advisor'
import { auroraBridge } from './aurora-bridge'

/**
 * Advice package sent to client
 */
export interface AdvicePackage {
  gameState: GameState
  tutorials: TutorialAdvice[]
  observations: Observation[]
  analyzedAt: number
}

/**
 * Analyze game state from live bridge data and return applicable advice
 */
export async function analyzeGameState(profileId: string): Promise<AdvicePackage | null> {
  if (!auroraBridge.isConnected) {
    console.log('[Analyzer] Bridge not connected — cannot analyze')
    return null
  }

  console.log('[Analyzer] Analyzing game state from bridge (live data)')
  console.log('[Analyzer] Using profile:', profileId)

  const gameState = await queryGameState()
  console.log('[Analyzer] Game state extracted:', gameState)

  // Load profile
  const profile = loadProfile(profileId)

  // Get tutorials
  const tutorials = getTutorialAdvice(gameState, profile)
  console.log('[Analyzer] Found', tutorials.length, 'applicable tutorials')

  // Detect observations from live data
  const rawObservations = await detectObservations(gameState)

  // Process observations: apply conditions and generate messages
  const processedObservations: Observation[] = []
  for (const obs of rawObservations) {
    const message = getObservationMessage(obs.id, obs, gameState, profile)
    processedObservations.push({
      id: obs.id,
      data: obs.data,
      message
    })
  }
  console.log('[Analyzer] Processed', processedObservations.length, 'observations')

  return {
    gameState,
    tutorials,
    observations: processedObservations,
    analyzedAt: Date.now()
  }
}

/**
 * Query game state from live bridge data
 *
 * Uses real-time memory reader data (bodies, fleets, systems).
 * Fields not yet available from the bridge are left at defaults.
 */
async function queryGameState(): Promise<GameState> {
  console.log('[Analyzer] Querying game state from bridge...')

  // Fetch all available data in parallel
  const [systems, fleets, bodies] = await Promise.all([
    auroraBridge.getKnownSystems().catch(() => []),
    auroraBridge.getFleets().catch(() => []),
    auroraBridge.getBodies().catch(() => [])
  ])

  // Derive what we can from available data
  const playerFleets = fleets.filter((f: Record<string, unknown>) => !f.IsCivilian)
  const hasShips = fleets.length > 0

  // Store counts as extended fields for display
  const gameState: GameState = {
    // These fields aren't available from memory reader yet — defaults
    gameYear: 0,
    hasTNTech: false,
    alienContact: false,
    atWar: false,
    // Derived from real data
    hasBuiltFirstShip: hasShips,
    hasSurveyedHomeSystem: false, // Can't determine yet without survey data

    // Extended fields for display (available via [key: string]: unknown)
    systemCount: systems.length,
    bodyCount: bodies.length,
    fleetCount: fleets.length,
    militaryFleetCount: playerFleets.length,
    civilianFleetCount: fleets.filter((f: Record<string, unknown>) => f.IsCivilian).length,
    totalShipCount: fleets.reduce(
      (sum: number, f: Record<string, unknown>) => sum + (Number(f.ShipCount) || 0),
      0
    )
  }

  return gameState
}

/**
 * Detect observations from live bridge data
 * Derives real observations from fleets, bodies, and systems data
 */
async function detectObservations(gameState: GameState): Promise<Observation[]> {
  console.log('[Analyzer] Detecting observations from live data...')

  const observations: Observation[] = []

  try {
    const fleets = await auroraBridge.getFleets().catch(() => [])

    // Detect idle fleets (speed = 0, meaning stationary)
    const idleFleets = fleets.filter(
      (f: Record<string, unknown>) => Number(f.Speed) === 0 && !f.IsCivilian
    )
    if (idleFleets.length > 0) {
      observations.push({
        id: 'idle-fleets',
        data: {
          count: idleFleets.length,
          fleetNames: idleFleets
            .slice(0, 5)
            .map((f: Record<string, unknown>) => f.FleetName)
            .join(', ')
        }
      })
    }

    // Detect fleets with low ship count (potential stragglers)
    const smallFleets = fleets.filter(
      (f: Record<string, unknown>) => Number(f.ShipCount) === 1 && !f.IsCivilian
    )
    if (smallFleets.length >= 3) {
      observations.push({
        id: 'scattered-ships',
        data: {
          count: smallFleets.length,
          fleetNames: smallFleets
            .slice(0, 5)
            .map((f: Record<string, unknown>) => f.FleetName)
            .join(', ')
        }
      })
    }

    // No fleets at all — early game hint
    if (fleets.length === 0 && gameState.hasBuiltFirstShip === false) {
      observations.push({
        id: 'no-fleets',
        data: {}
      })
    }
  } catch (err) {
    console.warn('[Analyzer] Failed to detect fleet observations:', err)
  }

  console.log('[Analyzer] Detected', observations.length, 'observations')
  return observations
}
