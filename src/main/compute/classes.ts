import type { QueryFn, GameCtx, ShipClassSummary, ShipClassDetail } from './types'

export async function getShipClasses(query: QueryFn, ctx: GameCtx): Promise<ShipClassSummary[]> {
  return query<ShipClassSummary>(
    `SELECT ShipClassID, ClassName, MaxSpeed, FuelCapacity, EnginePower, FuelEfficiency,
      Size * 50 as Tonnage, Commercial, MilitaryEngines, FighterClass, JumpDistance
    FROM FCT_ShipClass
    WHERE GameID = ${ctx.gameId} AND RaceID = ${ctx.raceId} AND Obsolete = 0
    ORDER BY ClassName`
  )
}

export async function getShipClassDetail(
  query: QueryFn,
  ctx: GameCtx,
  classId: number
): Promise<ShipClassDetail> {
  const classRows = await query<Record<string, unknown>>(
    `SELECT ShipClassID, ClassName, RaceID, Size * 50 as Tonnage, MaxSpeed, FuelCapacity, Crew,
      PlannedDeployment, CargoCapacity, MagazineCapacity, JumpDistance, Cost as BuildPointCost,
      Commercial, FighterClass, MilitaryEngines, EnginePower, FuelEfficiency,
      ShieldStrength, ArmourThickness, ArmourWidth, ActiveSensorStrength, PassiveSensorStrength,
      EMSensorStrength, ReactorPower, STSTractor, GravSurvey, GeoSurvey, DCRating, ControlRating,
      MaintSupplies, Locked
    FROM FCT_ShipClass WHERE ShipClassID = ${classId} AND GameID = ${ctx.gameId}`
  )

  if (classRows.length === 0) throw new Error(`Class ${classId} not found`)

  const components = await query<{
    NumComponent: number
    Name: string
    Tons: number
    HTK: number
    CompCrew: number
    Weapon: boolean
    MilitarySystem: boolean
  }>(
    `SELECT cc.NumComponent, sdc.Name, sdc.Size * 50 as Tons, sdc.HTK, sdc.Crew as CompCrew,
      sdc.Weapon, sdc.MilitarySystem
    FROM FCT_ClassComponent cc
    JOIN FCT_ShipDesignComponents sdc ON cc.ComponentID = sdc.SDComponentID
    WHERE cc.ClassID = ${classId} AND cc.GameID = ${ctx.gameId}
    ORDER BY sdc.Size DESC`
  )

  return { class: classRows[0] as unknown as ShipClassDetail['class'], components }
}
