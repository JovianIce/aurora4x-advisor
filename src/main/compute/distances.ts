import type { QueryFn, GameCtx } from './types'
import { euclidean } from './utils'

interface JumpPoint {
  WarpPointID: number
  SystemID: number
  WPLink: number
  Xcor: number
  Ycor: number
}

interface JumpEdge {
  fromSystem: number
  toSystem: number
  fromJP: JumpPoint
  toJP: JumpPoint
}

export interface DistanceInfo {
  jumpsToSol: number | null
  routeToSol: number[]
  estimatedTravelDays: number | null
}

export interface JumpNetwork {
  edges: JumpEdge[]
  jumpPoints: Map<number, JumpPoint[]>
  distToSol: Map<number, number>
  routeToSol: Map<number, number[]>
}

const SOL_ID = 21625

export async function buildJumpNetwork(query: QueryFn, ctx: GameCtx): Promise<JumpNetwork> {
  const jps = await query<JumpPoint>(
    `SELECT WarpPointID, SystemID, WPLink, Xcor, Ycor FROM FCT_JumpPoint WHERE GameID = ${ctx.gameId}`
  )

  const jpById = new Map<number, JumpPoint>()
  const jpsBySystem = new Map<number, JumpPoint[]>()

  for (const jp of jps) {
    jpById.set(jp.WarpPointID, jp)
    if (!jpsBySystem.has(jp.SystemID)) jpsBySystem.set(jp.SystemID, [])
    jpsBySystem.get(jp.SystemID)!.push(jp)
  }

  const edges: JumpEdge[] = []
  const neighbors = new Map<number, Set<number>>()

  for (const jp of jps) {
    if (jp.WPLink === 0) continue
    const linked = jpById.get(jp.WPLink)
    if (!linked) continue

    edges.push({ fromSystem: jp.SystemID, toSystem: linked.SystemID, fromJP: jp, toJP: linked })

    if (!neighbors.has(jp.SystemID)) neighbors.set(jp.SystemID, new Set())
    neighbors.get(jp.SystemID)!.add(linked.SystemID)
  }

  // BFS from Sol
  const distToSol = new Map<number, number>()
  const routeToSol = new Map<number, number[]>()
  const queue: number[] = [SOL_ID]
  distToSol.set(SOL_ID, 0)
  routeToSol.set(SOL_ID, [SOL_ID])

  while (queue.length > 0) {
    const current = queue.shift()!
    const currentDist = distToSol.get(current)!
    const currentRoute = routeToSol.get(current)!

    for (const neighbor of neighbors.get(current) || []) {
      if (!distToSol.has(neighbor)) {
        distToSol.set(neighbor, currentDist + 1)
        routeToSol.set(neighbor, [...currentRoute, neighbor])
        queue.push(neighbor)
      }
    }
  }

  return { edges, jumpPoints: jpsBySystem, distToSol, routeToSol }
}

export function distToNearestJP(
  x: number,
  y: number,
  systemId: number,
  jumpPoints: Map<number, JumpPoint[]>
): { distance: number; jp: JumpPoint } | null {
  const jps = jumpPoints.get(systemId)
  if (!jps || jps.length === 0) return null

  let best: JumpPoint | null = null
  let bestDist = Infinity

  for (const jp of jps) {
    const d = euclidean(x, y, jp.Xcor, jp.Ycor)
    if (d < bestDist) {
      bestDist = d
      best = jp
    }
  }

  return best ? { distance: bestDist, jp: best } : null
}

export function estimateTravelToSol(
  x: number,
  y: number,
  systemId: number,
  speed: number,
  network: JumpNetwork
): DistanceInfo {
  const jumps = network.distToSol.get(systemId)
  if (jumps == null) return { jumpsToSol: null, routeToSol: [], estimatedTravelDays: null }

  const route = network.routeToSol.get(systemId) || []

  if (speed <= 0) return { jumpsToSol: jumps, routeToSol: route, estimatedTravelDays: null }

  let totalKm = 0

  const toJP = distToNearestJP(x, y, systemId, network.jumpPoints)
  if (toJP) totalKm += toJP.distance

  if (jumps > 0) {
    totalKm += (jumps - 1) * 2_000_000_000
  }

  if (systemId !== SOL_ID) {
    totalKm += 150_000_000
  }

  const travelSeconds = totalKm / speed
  const travelDays = travelSeconds / 86400

  return {
    jumpsToSol: jumps,
    routeToSol: route,
    estimatedTravelDays: Math.round(travelDays * 10) / 10
  }
}

export function findNearestTanker(
  shipSystemId: number,
  shipX: number,
  shipY: number,
  tankers: { shipId: number; name: string; systemId: number; x: number; y: number; fuel: number }[],
  distToSolMap: Map<number, number>
): {
  shipId: number
  name: string
  fuel: number
  sameSystem: boolean
  jumpDistance: number
  inSystemKm: number
} | null {
  if (tankers.length === 0) return null

  let best: (typeof tankers)[0] | null = null
  let bestScore = Infinity
  let bestSameSystem = false
  let bestJumps = 0
  let bestInSystemKm = 0

  for (const t of tankers) {
    const sameSystem = t.systemId === shipSystemId
    let jumps = 0
    let inSystemKm = 0

    if (sameSystem) {
      inSystemKm = euclidean(shipX, shipY, t.x, t.y)
      const score = inSystemKm
      if (score < bestScore) {
        bestScore = score
        best = t
        bestSameSystem = true
        bestJumps = 0
        bestInSystemKm = inSystemKm
      }
    } else {
      const shipToSol = distToSolMap.get(shipSystemId) ?? 999
      const tankerToSol = distToSolMap.get(t.systemId) ?? 999
      jumps = Math.abs(shipToSol - tankerToSol) + 1
      const score = jumps * 10_000_000_000
      if (score < bestScore) {
        bestScore = score
        best = t
        bestSameSystem = false
        bestJumps = jumps
        bestInSystemKm = 0
      }
    }
  }

  if (!best) return null

  return {
    shipId: best.shipId,
    name: best.name,
    fuel: best.fuel,
    sameSystem: bestSameSystem,
    jumpDistance: bestJumps,
    inSystemKm: bestInSystemKm
  }
}
