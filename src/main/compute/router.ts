import type {
  QueryFn,
  GameCtx,
  JumpAnalysis,
  GeometryLeg,
  RouteLeg,
  RouteResult,
  RouteRequest,
  FleetRouteWaypoint,
  FleetRouteRequest,
  ShipFuelLeg,
  FleetRouteLeg,
  FleetRouteResult,
  FleetShip,
  Fleet,
  RouteWaypoint
} from './types'
import { buildJumpNetwork, type JumpNetwork } from './distances'
import { euclidean } from './utils'

function bfsPath(
  from: number,
  to: number,
  edges: { fromSystem: number; toSystem: number }[]
): number[] | null {
  const neighbors = new Map<number, Set<number>>()
  for (const e of edges) {
    if (!neighbors.has(e.fromSystem)) neighbors.set(e.fromSystem, new Set())
    neighbors.get(e.fromSystem)!.add(e.toSystem)
  }

  const visited = new Set<number>()
  const queue: number[][] = [[from]]
  visited.add(from)

  while (queue.length > 0) {
    const path = queue.shift()!
    const current = path[path.length - 1]
    if (current === to) return path
    for (const next of neighbors.get(current) || []) {
      if (!visited.has(next)) {
        visited.add(next)
        queue.push([...path, next])
      }
    }
  }

  return null
}

interface BuildLegsOpts {
  speed: number
  startX?: number
  startY?: number
  endX?: number
  endY?: number
}

async function buildRouteLegs(
  query: QueryFn,
  ctx: GameCtx,
  systemSequence: number[],
  opts: BuildLegsOpts
): Promise<{
  legs: GeometryLeg[]
  network: JumpNetwork
  sysName: (id: number) => string
}> {
  const { speed, startX, startY, endX, endY } = opts

  const network = await buildJumpNetwork(query, ctx)

  const systemRows = await query<{ SystemID: number; Name: string }>(
    `SELECT SystemID, Name FROM FCT_RaceSysSurvey WHERE GameID = ${ctx.gameId} AND RaceID = ${ctx.raceId}`
  )
  const systemNames = new Map<number, string>()
  for (const r of systemRows) {
    systemNames.set(r.SystemID, r.Name)
  }
  const sysName = (id: number): string => systemNames.get(id) || `System ${id}`

  if (speed <= 0) throw new Error('Speed is zero - cannot compute route')

  const legs: GeometryLeg[] = []

  for (let i = 0; i < systemSequence.length - 1; i++) {
    const fromSys = systemSequence[i]
    const toSys = systemSequence[i + 1]

    if (fromSys === toSys) {
      if (
        i === 0 &&
        startX != null &&
        startY != null &&
        i === systemSequence.length - 2 &&
        endX != null &&
        endY != null
      ) {
        const dist = euclidean(startX, startY, endX, endY)
        const travelSec = dist / speed
        legs.push({
          from: { systemId: fromSys, systemName: sysName(fromSys) },
          to: { systemId: toSys, systemName: sysName(toSys) },
          type: 'in-system',
          distanceKm: dist,
          travelSeconds: travelSec,
          travelDays: travelSec / 86400
        })
      }
      continue
    }

    const path = bfsPath(fromSys, toSys, network.edges)
    if (!path) throw new Error(`No route from ${sysName(fromSys)} to ${sysName(toSys)}`)

    for (let j = 0; j < path.length - 1; j++) {
      const curSys = path[j]
      const nextSys = path[j + 1]

      const jpsInCurSys = network.jumpPoints.get(curSys) || []
      const exitJP = jpsInCurSys.find((jp) => {
        const linked = network.edges.find((e) => e.fromJP.WarpPointID === jp.WarpPointID)
        return linked && linked.toSystem === nextSys
      })

      let startXLeg: number, startYLeg: number
      if (j === 0 && i === 0 && startX != null && startY != null) {
        startXLeg = startX
        startYLeg = startY
      } else {
        const prevEntryJP = jpsInCurSys.find((jp) => {
          if (j === 0) return false
          const linked = network.edges.find((e) => e.fromJP.WarpPointID === jp.WarpPointID)
          return linked && linked.toSystem === path[j - 1]
        })
        startXLeg = prevEntryJP?.Xcor ?? 0
        startYLeg = prevEntryJP?.Ycor ?? 0
      }

      if (exitJP) {
        const inSystemDist = euclidean(startXLeg, startYLeg, exitJP.Xcor, exitJP.Ycor)
        const travelSec = inSystemDist / speed

        legs.push({
          from: { systemId: curSys, systemName: sysName(curSys) },
          to: { systemId: curSys, systemName: `JP → ${sysName(nextSys)}` },
          type: 'in-system',
          distanceKm: inSystemDist,
          travelSeconds: travelSec,
          travelDays: travelSec / 86400
        })
      }

      legs.push({
        from: { systemId: curSys, systemName: sysName(curSys) },
        to: { systemId: nextSys, systemName: sysName(nextSys) },
        type: 'jump',
        distanceKm: 0,
        travelSeconds: 0,
        travelDays: 0
      })
    }

    // Final in-system transit at destination
    if (i === systemSequence.length - 2 && endX != null && endY != null) {
      const destSys = path[path.length - 1]
      const jpsInDest = network.jumpPoints.get(destSys) || []
      const entryFromPrev = jpsInDest.find((jp) => {
        const linked = network.edges.find((e) => e.fromJP.WarpPointID === jp.WarpPointID)
        return linked && linked.toSystem === path[path.length - 2]
      })

      if (entryFromPrev) {
        const dist = euclidean(entryFromPrev.Xcor, entryFromPrev.Ycor, endX, endY)
        const travelSec = dist / speed
        legs.push({
          from: {
            systemId: destSys,
            systemName: `JP from ${sysName(path[path.length - 2])}`
          },
          to: { systemId: destSys, systemName: sysName(destSys) },
          type: 'in-system',
          distanceKm: dist,
          travelSeconds: travelSec,
          travelDays: travelSec / 86400
        })
      }
    }
  }

  return { legs, network, sysName }
}

export async function computeRoute(query: QueryFn, ctx: GameCtx, req: RouteRequest): Promise<RouteResult> {
  const classRows = await query<{
    ClassName: string
    MaxSpeed: number
    FuelCapacity: number
    EnginePower: number
    FuelEfficiency: number
  }>(
    `SELECT ClassName, MaxSpeed, FuelCapacity, EnginePower, FuelEfficiency
     FROM FCT_ShipClass WHERE ShipClassID = ${req.classId} AND GameID = ${ctx.gameId}`
  )

  const classRow = classRows[0]
  if (!classRow) throw new Error(`Ship class ${req.classId} not found`)

  const speed = classRow.MaxSpeed
  const fuelCapacity = classRow.FuelCapacity
  const burnRate = classRow.EnginePower * classRow.FuelEfficiency
  const className = classRow.ClassName

  const systemSequence: number[] = [req.startSystemId]
  if (req.waypointSystemIds) systemSequence.push(...req.waypointSystemIds)
  systemSequence.push(req.endSystemId)

  const { legs: geoLegs } = await buildRouteLegs(query, ctx, systemSequence, {
    speed,
    startX: req.startX,
    startY: req.startY,
    endX: req.endX,
    endY: req.endY
  })

  const legs: RouteLeg[] = geoLegs.map((l) => ({
    ...l,
    fuelBurn: burnRate * (l.travelSeconds / 3600)
  }))

  const totalDistanceKm = legs.reduce((s, l) => s + l.distanceKm, 0)
  const totalTravelDays = legs.reduce((s, l) => s + l.travelDays, 0)
  const totalFuelBurn = legs.reduce((s, l) => s + l.fuelBurn, 0)

  return {
    legs: legs.map((l) => ({
      ...l,
      distanceKm: Math.round(l.distanceKm),
      travelDays: Math.round(l.travelDays * 100) / 100,
      fuelBurn: Math.round(l.fuelBurn)
    })),
    totalDistanceKm: Math.round(totalDistanceKm),
    totalTravelDays: Math.round(totalTravelDays * 100) / 100,
    totalFuelBurn: Math.round(totalFuelBurn),
    fuelCapacity,
    fuelRemaining: Math.round(fuelCapacity - totalFuelBurn),
    sufficient: totalFuelBurn <= fuelCapacity,
    speed,
    className
  }
}

export async function computeFleetRoute(
  query: QueryFn,
  ctx: GameCtx,
  req: FleetRouteRequest
): Promise<FleetRouteResult> {
  // 1. Get fleet info
  const fleetRows = await query<{
    FleetID: number
    FleetName: string
    SystemID: number
    Speed: number
    Xcor: number
    Ycor: number
    SystemName: string
  }>(
    `SELECT f.FleetID, f.FleetName, f.SystemID, f.Speed, f.Xcor, f.Ycor,
       rss.Name as SystemName
     FROM FCT_Fleet f
     LEFT JOIN FCT_RaceSysSurvey rss ON f.SystemID = rss.SystemID
       AND rss.GameID = ${ctx.gameId} AND rss.RaceID = ${ctx.raceId}
     WHERE f.FleetID = ${req.fleetId} AND f.GameID = ${ctx.gameId}`
  )

  const fleetRow = fleetRows[0]
  if (!fleetRow) throw new Error(`Fleet ${req.fleetId} not found`)

  // 2. Get all ships in fleet
  const shipRows = await query<{
    ShipID: number
    ShipName: string
    Fuel: number
    ShipClassID: number
    ClassName: string
    MaxSpeed: number
    FuelCapacity: number
    EnginePower: number
    FuelEfficiency: number
    FuelTanker: number
    JumpDistance: number
  }>(
    `SELECT s.ShipID, s.ShipName, s.Fuel,
       sc.ShipClassID, sc.ClassName, sc.MaxSpeed, sc.FuelCapacity,
       sc.EnginePower, sc.FuelEfficiency, sc.FuelTanker, sc.JumpDistance
     FROM FCT_Ship s
     JOIN FCT_ShipClass sc ON s.ShipClassID = sc.ShipClassID
     WHERE s.FleetID = ${req.fleetId} AND s.GameID = ${ctx.gameId} AND s.Destroyed = 0
     ORDER BY sc.ClassName, s.ShipName`
  )

  if (shipRows.length === 0) throw new Error('Fleet has no ships')

  const ships = shipRows.map((s) => ({
    shipId: s.ShipID,
    name: s.ShipName,
    className: s.ClassName,
    classId: s.ShipClassID,
    fuel: s.Fuel,
    fuelCapacity: s.FuelCapacity,
    maxSpeed: s.MaxSpeed,
    enginePower: s.EnginePower,
    fuelEfficiency: s.FuelEfficiency,
    isTanker: s.FuelTanker > 0,
    jumpCapable: (s.JumpDistance || 0) > 0,
    burnRate: s.EnginePower * s.FuelEfficiency
  }))

  // 3. Fleet speed = minimum of all ships with engines
  const shipsWithEngines = ships.filter((s) => s.maxSpeed > 0)
  if (shipsWithEngines.length === 0) throw new Error('No ships in fleet have engines')

  const slowest = shipsWithEngines.reduce((a, b) => (a.maxSpeed < b.maxSpeed ? a : b))
  const fleetSpeed = slowest.maxSpeed

  // 4. Build system sequence
  const startSystemId = fleetRow.SystemID
  const systemSequence: number[] = [startSystemId]

  const refuelSystems = new Set<number>()
  if (req.waypoints) {
    for (const wp of req.waypoints) {
      systemSequence.push(wp.systemId)
      if (wp.refuel) refuelSystems.add(wp.systemId)
    }
  }
  systemSequence.push(req.endSystemId)

  // 5. Build geometry legs at fleet speed
  const { legs: geoLegs } = await buildRouteLegs(query, ctx, systemSequence, {
    speed: fleetSpeed,
    startX: fleetRow.Xcor,
    startY: fleetRow.Ycor
  })

  // 6. Track per-ship fuel across legs
  const fuelState = new Map<number, number>()
  for (const s of ships) {
    fuelState.set(s.shipId, s.fuel)
  }

  const tankers = ships.filter((s) => s.isTanker)

  let bottleneck: FleetRouteResult['bottleneck'] = null
  const fleetLegs: FleetRouteLeg[] = []

  for (let li = 0; li < geoLegs.length; li++) {
    const geo = geoLegs[li]
    const isRefuelStop = geo.type === 'jump' && refuelSystems.has(geo.to.systemId)

    const shipFuelEntries: ShipFuelLeg[] = []

    for (const ship of ships) {
      const fuelBurn = ship.burnRate * (geo.travelSeconds / 3600)
      const currentFuel = fuelState.get(ship.shipId)!
      const remaining = currentFuel - fuelBurn

      fuelState.set(ship.shipId, remaining)

      if (remaining < 0 && !bottleneck) {
        bottleneck = {
          shipId: ship.shipId,
          name: ship.name,
          className: ship.className,
          runsOutOnLeg: li,
          shortfall: Math.round(Math.abs(remaining))
        }
      }

      shipFuelEntries.push({
        shipId: ship.shipId,
        name: ship.name,
        className: ship.className,
        burnRate: Math.round(ship.burnRate * 100) / 100,
        fuelBurn: Math.round(fuelBurn),
        fuelRemaining: Math.round(remaining),
        fuelPct:
          ship.fuelCapacity > 0
            ? Math.round((Math.max(0, remaining) / ship.fuelCapacity) * 100)
            : 0,
        sufficient: remaining >= 0
      })
    }

    fleetLegs.push({
      ...geo,
      distanceKm: Math.round(geo.distanceKm),
      travelDays: Math.round(geo.travelDays * 100) / 100,
      shipFuel: shipFuelEntries,
      refuelStop: isRefuelStop
    })

    if (isRefuelStop) {
      for (const ship of ships) {
        fuelState.set(ship.shipId, ship.fuelCapacity)
      }
    }
  }

  let tankerSummary: FleetRouteResult['tankerInFleet'] = null
  if (tankers.length > 0) {
    const primaryTanker = tankers[0]
    tankerSummary = {
      shipId: primaryTanker.shipId,
      name: primaryTanker.name,
      fuelCapacity: primaryTanker.fuelCapacity,
      fuelRemaining: Math.round(fuelState.get(primaryTanker.shipId)!)
    }
  }

  const totalDistanceKm = geoLegs.reduce((s, l) => s + l.distanceKm, 0)
  const totalTravelDays = geoLegs.reduce((s, l) => s + l.travelDays, 0)

  return {
    fleetName: fleetRow.FleetName,
    fleetSpeed,
    speedLimitedBy: `${slowest.name} (${slowest.className})`,
    legs: fleetLegs,
    totalDistanceKm: Math.round(totalDistanceKm),
    totalTravelDays: Math.round(totalTravelDays * 100) / 100,
    bottleneck,
    tankerInFleet: tankerSummary
  }
}

export async function getFleets(query: QueryFn, ctx: GameCtx): Promise<Fleet[]> {
  const fleetRows = await query<{
    FleetID: number
    FleetName: string
    SystemID: number
    Speed: number
    Xcor: number
    Ycor: number
    SystemName: string
  }>(
    `SELECT f.FleetID, f.FleetName, f.SystemID, f.Speed, f.Xcor, f.Ycor,
       rss.Name as SystemName
     FROM FCT_Fleet f
     LEFT JOIN FCT_RaceSysSurvey rss ON f.SystemID = rss.SystemID
       AND rss.GameID = ${ctx.gameId} AND rss.RaceID = ${ctx.raceId}
     WHERE f.GameID = ${ctx.gameId} AND f.RaceID = ${ctx.raceId}
     ORDER BY f.FleetName`
  )

  const shipRows = await query<{
    ShipID: number
    ShipName: string
    FleetID: number
    Fuel: number
    ShipClassID: number
    ClassName: string
    MaxSpeed: number
    FuelCapacity: number
    EnginePower: number
    FuelEfficiency: number
    FuelTanker: number
    JumpDistance: number
    MilitaryEngines: number
    Commercial: number
    Tonnage: number
  }>(
    `SELECT s.ShipID, s.ShipName, s.FleetID, s.Fuel,
       sc.ShipClassID, sc.ClassName, sc.MaxSpeed, sc.FuelCapacity,
       sc.EnginePower, sc.FuelEfficiency, sc.FuelTanker, sc.JumpDistance,
       sc.MilitaryEngines, sc.Commercial, sc.Size * 50 as Tonnage
     FROM FCT_Ship s
     JOIN FCT_ShipClass sc ON s.ShipClassID = sc.ShipClassID
     WHERE s.GameID = ${ctx.gameId} AND s.RaceID = ${ctx.raceId} AND s.Destroyed = 0
     ORDER BY sc.ClassName, s.ShipName`
  )

  const shipsByFleet = new Map<number, FleetShip[]>()
  for (const s of shipRows) {
    const fid = s.FleetID
    if (!shipsByFleet.has(fid)) shipsByFleet.set(fid, [])
    shipsByFleet.get(fid)!.push({
      shipId: s.ShipID,
      shipName: s.ShipName,
      className: s.ClassName,
      classId: s.ShipClassID,
      fuel: Math.round(s.Fuel),
      fuelCapacity: s.FuelCapacity,
      tonnage: Math.round(s.Tonnage || 0),
      maxSpeed: s.MaxSpeed,
      enginePower: s.EnginePower,
      fuelEfficiency: s.FuelEfficiency,
      isTanker: (s.FuelTanker || 0) > 0,
      jumpCapable: (s.JumpDistance || 0) > 0,
      jumpDriveInfo: null, // populated after classJD is built
      isMilitary: !!s.MilitaryEngines,
      isCommercial: !!s.Commercial
    })
  }

  // Query jump drive components for tender analysis
  const jdRows = await query<{
    ClassID: number
    JDName: string
    Tonnage: number
  }>(
    `SELECT cc.ClassID, sdc.Name as JDName, sc.Size * 50 as Tonnage
    FROM FCT_ClassComponent cc
    JOIN FCT_ShipDesignComponents sdc ON cc.ComponentID = sdc.SDComponentID
    JOIN FCT_ShipClass sc ON cc.ClassID = sc.ShipClassID AND sc.GameID = ${ctx.gameId}
    WHERE cc.GameID = ${ctx.gameId} AND sdc.Name LIKE '%Jump Drive%'`
  )

  // Build class → JD info map
  const classJD = new Map<number, { name: string; isMilJD: boolean; isCommJD: boolean; maxTonnage: number; squadMax: number; radius: number }>()
  for (const jd of jdRows) {
    const isMilJD = jd.JDName.includes('Military')
    const isCommJD = jd.JDName.includes('Commercial')
    // Parse from name: J16000(4-100) = 16000t max, 4 squad, 100 radius
    // JC75K = 75000t commercial
    let maxTonnage = 0
    let squadMax = 0
    let radius = 0
    const milMatch = jd.JDName.match(/^J(\d+)\((\d+)-(\d+)\)/)
    const commMatch = jd.JDName.match(/^JC(\d+)K/)
    if (milMatch) {
      maxTonnage = parseInt(milMatch[1])
      squadMax = parseInt(milMatch[2])
      radius = parseInt(milMatch[3])
    } else if (commMatch) {
      maxTonnage = parseInt(commMatch[1]) * 1000
    }
    classJD.set(jd.ClassID, { name: jd.JDName, isMilJD, isCommJD, maxTonnage, squadMax, radius })
  }

  // Populate jumpDriveInfo on ships
  for (const ships of shipsByFleet.values()) {
    for (const s of ships) {
      const jd = classJD.get(s.classId)
      if (jd) {
        s.jumpDriveInfo = {
          name: jd.name,
          type: jd.isMilJD ? 'Military' : jd.isCommJD ? 'Commercial' : 'Unknown',
          maxTonnage: jd.maxTonnage,
          squadMax: jd.squadMax,
          radius: jd.radius
        }
      }
    }
  }

  return fleetRows
    .filter((f) => shipsByFleet.has(f.FleetID) && shipsByFleet.get(f.FleetID)!.length > 0)
    .map((f) => {
      const ships = shipsByFleet.get(f.FleetID)!
      return {
        fleetId: f.FleetID,
        fleetName: f.FleetName,
        systemId: f.SystemID,
        systemName: f.SystemName || 'Transit',
        speed: f.Speed || 0,
        x: f.Xcor || 0,
        y: f.Ycor || 0,
        ships,
        jumpAnalysis: analyzeFleetJump(ships, classJD)
      }
    })
}

function analyzeFleetJump(
  ships: FleetShip[],
  classJD: Map<number, { name: string; isMilJD: boolean; isCommJD: boolean; maxTonnage: number; squadMax: number; radius: number }>
): JumpAnalysis {
  const shipsWithoutJD = ships.filter((s) => !s.jumpCapable)

  if (shipsWithoutJD.length === 0) {
    return { allJumpCapable: true, shipsWithoutJD: [], milTender: null, commTender: null, uncoveredShips: [], status: 'ok' }
  }

  // Find best military and commercial tenders in fleet
  let milTender: JumpAnalysis['milTender'] = null
  let commTender: JumpAnalysis['commTender'] = null
  let milSquadMax = 0
  let commSquadMax = 0

  for (const s of ships) {
    if (!s.jumpCapable) continue
    const jd = classJD.get(s.classId)
    if (!jd) continue

    if (jd.isMilJD && (!milTender || jd.maxTonnage > milTender.maxTonnage)) {
      milTender = { shipName: s.shipName, className: s.className, maxTonnage: jd.maxTonnage, squadMax: jd.squadMax }
      milSquadMax = jd.squadMax
    }
    if (jd.isCommJD && (!commTender || jd.maxTonnage > commTender.maxTonnage)) {
      commTender = { shipName: s.shipName, className: s.className, maxTonnage: jd.maxTonnage, squadMax: jd.squadMax }
      commSquadMax = jd.squadMax
    }
  }

  // Check coverage per ship without JD
  // maxTonnage = max size of a single ship the JD can carry
  // squadMax = max number of ships the JD can carry at once
  const milNeeding = shipsWithoutJD.filter((s) => !s.isCommercial)
  const commNeeding = shipsWithoutJD.filter((s) => s.isCommercial)

  const uncoveredShips: JumpAnalysis['uncoveredShips'] = []
  const squadWarnings: string[] = []

  // Check military ships
  if (milNeeding.length > 0) {
    if (!milTender) {
      for (const s of milNeeding) uncoveredShips.push({ shipName: s.shipName, className: s.className, reason: 'No mil squad jump' })
    } else {
      // Check tonnage per ship
      for (const s of milNeeding) {
        if (s.tonnage > milTender.maxTonnage) {
          uncoveredShips.push({ shipName: s.shipName, className: s.className, reason: `Too heavy (${s.tonnage.toLocaleString()}t > ${milTender.maxTonnage.toLocaleString()}t)` })
        }
      }
      // Check squad count
      const fittingMil = milNeeding.filter((s) => s.tonnage <= milTender!.maxTonnage)
      if (milSquadMax > 0 && fittingMil.length > milSquadMax) {
        squadWarnings.push(`${fittingMil.length} mil ships need jump, squad max ${milSquadMax} per jump`)
      }
    }
  }

  // Check commercial ships
  if (commNeeding.length > 0) {
    if (!commTender) {
      for (const s of commNeeding) uncoveredShips.push({ shipName: s.shipName, className: s.className, reason: 'No comm squad jump' })
    } else {
      for (const s of commNeeding) {
        if (s.tonnage > commTender.maxTonnage) {
          uncoveredShips.push({ shipName: s.shipName, className: s.className, reason: `Too heavy (${s.tonnage.toLocaleString()}t > ${commTender.maxTonnage.toLocaleString()}t)` })
        }
      }
      const fittingComm = commNeeding.filter((s) => s.tonnage <= commTender!.maxTonnage)
      if (commSquadMax > 0 && fittingComm.length > commSquadMax) {
        squadWarnings.push(`${fittingComm.length} comm ships need jump, squad max ${commSquadMax} per jump`)
      }
    }
  }

  return {
    allJumpCapable: false,
    shipsWithoutJD: shipsWithoutJD.map((s) => ({
      shipName: s.shipName, className: s.className, isMilitary: s.isMilitary, isCommercial: s.isCommercial
    })),
    milTender,
    commTender,
    uncoveredShips,
    squadCapWarning: squadWarnings.length > 0 ? squadWarnings.join('; ') : null,
    status: uncoveredShips.length === 0 ? 'covered' : 'warning'
  }
}

export async function getWaypoints(query: QueryFn, ctx: GameCtx): Promise<RouteWaypoint[]> {
  const systems = await query<{ SystemID: number; Name: string }>(
    `SELECT SystemID, Name FROM FCT_RaceSysSurvey WHERE GameID = ${ctx.gameId} AND RaceID = ${ctx.raceId} ORDER BY Name`
  )

  const colonies = await query<{
    PopulationID: number
    PopName: string
    SystemBodyID: number
    SystemID: number
    Xcor: number
    Ycor: number
    SystemName: string
  }>(
    `SELECT p.PopulationID, p.PopName, p.SystemBodyID,
       sb.SystemID, sb.Xcor, sb.Ycor,
       rss.Name as SystemName
     FROM FCT_Population p
     JOIN FCT_SystemBody sb ON p.SystemBodyID = sb.SystemBodyID
     LEFT JOIN FCT_RaceSysSurvey rss ON sb.SystemID = rss.SystemID AND rss.GameID = ${ctx.gameId} AND rss.RaceID = ${ctx.raceId}
     WHERE p.GameID = ${ctx.gameId} AND p.RaceID = ${ctx.raceId}
     ORDER BY rss.Name, p.PopName`
  )

  const waypoints: RouteWaypoint[] = []

  for (const s of systems) {
    waypoints.push({
      systemId: s.SystemID,
      systemName: s.Name,
      label: `${s.Name} (system)`
    })
  }

  for (const c of colonies) {
    waypoints.push({
      systemId: c.SystemID,
      systemName: c.SystemName || 'Unknown',
      x: c.Xcor,
      y: c.Ycor,
      label: `${c.PopName} (${c.SystemName})`
    })
  }

  return waypoints
}
