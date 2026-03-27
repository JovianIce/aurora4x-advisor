import type { QueryFn, GameCtx, Ship } from './types'
import { buildJumpNetwork, estimateTravelToSol, findNearestTanker } from './distances'

export async function getShips(
  query: QueryFn,
  ctx: GameCtx
): Promise<{ ships: Ship[]; gameTime: number }> {
  const rows = await query<Record<string, unknown>>(
    `SELECT s.ShipID, s.ShipName, s.ShipClassID, s.Fuel, s.LastOverhaul, s.LastShoreLeave,
      s.MaintenanceState, s.CrewMorale,
      sc.ClassName, sc.MaxSpeed, sc.FuelCapacity, sc.PlannedDeployment,
      sc.FuelEfficiency, sc.EnginePower, sc.MilitaryEngines, sc.Commercial,
      sc.FighterClass, sc.FuelTanker, sc.CargoCapacity, sc.Size,
      f.FleetName, f.Speed as FleetSpeed, f.SystemID as FleetSystemID,
      f.Xcor as FleetX, f.Ycor as FleetY,
      rss.Name as SystemName
    FROM FCT_Ship s
    JOIN FCT_ShipClass sc ON s.ShipClassID = sc.ShipClassID
    JOIN FCT_Fleet f ON s.FleetID = f.FleetID
    LEFT JOIN FCT_RaceSysSurvey rss ON f.SystemID = rss.SystemID
      AND rss.GameID = ${ctx.gameId} AND rss.RaceID = ${ctx.raceId}
    WHERE s.GameID = ${ctx.gameId} AND s.RaceID = ${ctx.raceId} AND s.Destroyed = 0
    ORDER BY sc.MilitaryEngines DESC, sc.FighterClass DESC, sc.ClassName, s.ShipName`
  )

  const gameRows = await query<{ GameTime: number }>(
    `SELECT GameTime FROM FCT_Game WHERE GameID = ${ctx.gameId}`
  )
  const gameTime = gameRows[0]?.GameTime || 0

  const network = await buildJumpNetwork(query, ctx)

  // Identify tankers
  const tankerRows = rows.filter((s) => (s.FuelTanker as number) > 0)
  const tankers = tankerRows.map((s) => ({
    shipId: s.ShipID as number,
    name: s.ShipName as string,
    systemId: (s.FleetSystemID as number) || 0,
    x: (s.FleetX as number) || 0,
    y: (s.FleetY as number) || 0,
    fuel: Math.round(s.Fuel as number)
  }))

  const ships: Ship[] = rows.map((s) => {
    const burnRate = ((s.EnginePower as number) || 0) * ((s.FuelEfficiency as number) || 0)
    const fuel = s.Fuel as number
    const fuelCapacity = s.FuelCapacity as number
    const rangeDays = burnRate > 0 ? fuel / burnRate / 3600 / 24 : null
    const fuelPct = fuelCapacity > 0 ? Math.round((fuel / fuelCapacity) * 100) : null
    const monthsSinceOverhaul =
      Math.abs(gameTime - ((s.LastOverhaul as number) || 0)) / (30.44 * 24 * 3600)
    const monthsSinceShoreLeave =
      Math.abs(gameTime - ((s.LastShoreLeave as number) || 0)) / (30.44 * 24 * 3600)
    const plannedDeployment = s.PlannedDeployment as number
    const deploymentRemaining = plannedDeployment ? plannedDeployment - monthsSinceShoreLeave : null

    const systemId = (s.FleetSystemID as number) || 0
    const fleetSpeed = (s.FleetSpeed as number) || (s.MaxSpeed as number) || 0

    const solDistance = estimateTravelToSol(
      (s.FleetX as number) || 0,
      (s.FleetY as number) || 0,
      systemId,
      fleetSpeed,
      network
    )

    const nearTanker = findNearestTanker(
      systemId,
      (s.FleetX as number) || 0,
      (s.FleetY as number) || 0,
      tankers,
      network.distToSol
    )

    return {
      shipId: s.ShipID as number,
      shipClassId: s.ShipClassID as number,
      name: s.ShipName as string,
      className: s.ClassName as string,
      fleet: s.FleetName as string,
      system: (s.SystemName as string) || 'Transit',
      systemId,
      speed: fleetSpeed,
      fuel: Math.round(fuel),
      fuelCapacity,
      fuelPct,
      rangeDays: rangeDays ? Math.round(rangeDays) : null,
      commercial: !!(s.Commercial as number),
      military: !!(s.MilitaryEngines as number),
      fighter: !!(s.FighterClass as number),
      tanker: (s.FuelTanker as number) > 0,
      freighter: ((s.CargoCapacity as number) || 0) > ((s.Size as number) || 1) * 50 * 0.25,
      deploymentRemaining: deploymentRemaining ? Math.round(deploymentRemaining * 10) / 10 : null,
      monthsSinceOverhaul: Math.round(monthsSinceOverhaul * 10) / 10,
      maintenanceState: (s.MaintenanceState as number) || 0,
      jumpsToSol: solDistance.jumpsToSol,
      travelDaysToSol: solDistance.estimatedTravelDays,
      nearestTanker: nearTanker
        ? {
            shipId: nearTanker.shipId,
            name: nearTanker.name,
            fuel: nearTanker.fuel,
            sameSystem: nearTanker.sameSystem,
            jumps: nearTanker.jumpDistance
          }
        : null
    }
  })

  return { ships, gameTime }
}
