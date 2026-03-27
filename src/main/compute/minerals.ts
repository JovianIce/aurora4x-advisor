import { formatGameDate } from './utils'
import type {
  QueryFn,
  GameCtx,
  Resolution,
  MineralTotalsResult,
  MineralHistoryResult,
  MineralBreakdownResult,
  MineralColony
} from './types'

const MINERAL_NAMES: Record<number, string> = {
  1: 'Duranium',
  2: 'Neutronium',
  3: 'Corbomite',
  4: 'Tritanium',
  5: 'Boronide',
  6: 'Mercassium',
  7: 'Vendarite',
  8: 'Sorium',
  9: 'Uridium',
  10: 'Corundium',
  11: 'Gallicite'
}

const SECONDS_PER_MONTH = 2_592_000
const SECONDS_PER_QUARTER = 7_776_000
const SECONDS_PER_YEAR = 31_536_000

// Hardcoded from DIM_MineralDataType -bridge can't query DIM tables
const MINERAL_DATA_TYPES: Record<number, { income: boolean; desc: string }> = {
  1: { income: true, desc: 'Mining' },
  2: { income: false, desc: 'Ordnance Production' },
  3: { income: false, desc: 'Fighter Production' },
  4: { income: false, desc: 'Construction' },
  5: { income: false, desc: 'Shipbuilding' },
  6: { income: false, desc: 'Ground Unit Training' },
  7: { income: true, desc: 'Unloaded from Freighter' },
  8: { income: false, desc: 'Loaded into Freighter' },
  9: { income: false, desc: 'Shipyard Upgrades' },
  10: { income: true, desc: 'Recovered from Ruins' },
  11: { income: true, desc: 'Civilian Mining' },
  12: { income: false, desc: 'Sent by Mass Driver' },
  13: { income: true, desc: 'Received from Mass Driver' },
  14: { income: false, desc: 'Fuel Refining' },
  15: { income: true, desc: 'Scrapped Components' },
  16: { income: false, desc: 'Maintenance Production' },
  17: { income: true, desc: 'Scrapped Ground Units' },
  18: { income: true, desc: 'Scrapped Installations' },
  19: { income: true, desc: 'Scrapped Ordnance' },
  20: { income: true, desc: 'Starting Stockpile' },
  40: { income: false, desc: 'Ship Component Production' },
  45: { income: false, desc: 'Space Station Construction' }
}

function bucketSize(res: Resolution): number {
  switch (res) {
    case 'monthly':
      return SECONDS_PER_MONTH
    case 'quarterly':
      return SECONDS_PER_QUARTER
    case 'annual':
      return SECONDS_PER_YEAR
    default:
      return 0
  }
}

async function getStartYear(query: QueryFn, ctx: GameCtx): Promise<number> {
  const rows = await query<{ StartYear: number }>(
    `SELECT StartYear FROM FCT_Game WHERE GameID = ${ctx.gameId}`
  )
  return rows[0]?.StartYear || 2050
}

export async function getMineralTotals(query: QueryFn, ctx: GameCtx): Promise<MineralTotalsResult> {
  // FCT_SystemBody is empty via bridge -skip system name join
  const rows = await query<Record<string, unknown>>(
    `SELECT p.PopulationID, p.PopName,
      p.Duranium, p.Neutronium, p.Corbomite, p.Tritanium, p.Boronide,
      p.Mercassium, p.Vendarite, p.Sorium, p.Uridium, p.Corundium, p.Gallicite
    FROM FCT_Population p
    WHERE p.GameID = ${ctx.gameId} AND p.RaceID = ${ctx.raceId}
    ORDER BY p.PopName`
  )

  const mineralKeys = [
    'Duranium',
    'Neutronium',
    'Corbomite',
    'Tritanium',
    'Boronide',
    'Mercassium',
    'Vendarite',
    'Sorium',
    'Uridium',
    'Corundium',
    'Gallicite'
  ]

  const totals: Record<string, number> = {}
  for (const k of mineralKeys) totals[k] = 0

  const byColony: MineralTotalsResult['byColony'] = []

  for (const r of rows) {
    const minerals: Record<string, number> = {}
    for (const k of mineralKeys) {
      const v = Math.round((r[k] as number) || 0)
      minerals[k] = v
      totals[k] += v
    }
    byColony.push({
      populationId: r.PopulationID as number,
      name: r.PopName as string,
      system: '',
      minerals
    })
  }

  for (const k of mineralKeys) totals[k] = Math.round(totals[k])

  return { totals, byColony }
}

export async function getMineralHistory(
  query: QueryFn,
  ctx: GameCtx,
  resolution: Resolution = 'monthly',
  populationId: number | null = null
): Promise<MineralHistoryResult> {
  const startYear = await getStartYear(query, ctx)

  const popFilter = populationId ? `AND rmd.PopulationID = ${populationId}` : ''

  const rows = await query<{
    Time: number
    MineralID: number
    MineralDataType: number
    Amount: number
  }>(
    `SELECT rmd.Time, rmd.MineralID, rmd.MineralDataType, rmd.Amount
    FROM FCT_RaceMineralData rmd
    WHERE rmd.GameID = ${ctx.gameId} AND rmd.RaceID = ${ctx.raceId} ${popFilter}
    ORDER BY rmd.Time`
  )

  const bucket = bucketSize(resolution)
  const bucketedChanges = new Map<number, Map<number, number>>()

  for (const r of rows) {
    const time = r.Time
    const mineralId = r.MineralID
    const amount = r.Amount
    const typeInfo = MINERAL_DATA_TYPES[r.MineralDataType]
    const isIncome = typeInfo?.income ?? false
    const signed = isIncome ? amount : -amount

    const bt = bucket > 0 ? Math.floor(time / bucket) * bucket : time

    if (!bucketedChanges.has(bt)) bucketedChanges.set(bt, new Map())
    const mineralMap = bucketedChanges.get(bt)!
    mineralMap.set(mineralId, (mineralMap.get(mineralId) || 0) + signed)
  }

  const sortedTimes = [...bucketedChanges.keys()].sort((a, b) => a - b)

  const running: Record<number, number> = {}
  for (let i = 1; i <= 11; i++) running[i] = 0

  const series: MineralHistoryResult['series'] = []

  for (const bt of sortedTimes) {
    const changes = bucketedChanges.get(bt)!
    for (const [mid, delta] of changes) {
      running[mid] += delta
    }

    const minerals: Record<string, number> = {}
    for (let i = 1; i <= 11; i++) {
      minerals[MINERAL_NAMES[i]] = Math.round(running[i])
    }

    series.push({
      time: bt,
      gameDate: formatGameDate(bt, startYear),
      minerals
    })
  }

  return { resolution, populationId, series }
}

export async function getMineralBreakdown(
  query: QueryFn,
  ctx: GameCtx,
  mineralId: number,
  resolution: Resolution = 'monthly'
): Promise<MineralBreakdownResult> {
  const startYear = await getStartYear(query, ctx)

  const rows = await query<{ Time: number; MineralDataType: number; Amount: number }>(
    `SELECT rmd.Time, rmd.MineralDataType, rmd.Amount
    FROM FCT_RaceMineralData rmd
    WHERE rmd.GameID = ${ctx.gameId} AND rmd.RaceID = ${ctx.raceId}
      AND rmd.MineralID = ${mineralId}
    ORDER BY rmd.Time`
  )

  const bucket = bucketSize(resolution)
  const buckets = new Map<
    number,
    { income: Map<string, number>; expense: Map<string, number> }
  >()

  for (const r of rows) {
    const time = r.Time
    const amount = r.Amount
    const info = MINERAL_DATA_TYPES[r.MineralDataType]
    if (!info) continue

    const bt = bucket > 0 ? Math.floor(time / bucket) * bucket : time

    if (!buckets.has(bt)) buckets.set(bt, { income: new Map(), expense: new Map() })
    const b = buckets.get(bt)!

    const target = info.income ? b.income : b.expense
    target.set(info.desc, (target.get(info.desc) || 0) + amount)
  }

  const sortedTimes = [...buckets.keys()].sort((a, b) => a - b)

  const series: MineralBreakdownResult['series'] = sortedTimes.map((bt) => {
    const b = buckets.get(bt)!
    const income: Record<string, number> = {}
    const expense: Record<string, number> = {}
    let totalIncome = 0
    let totalExpense = 0

    for (const [desc, amt] of b.income) {
      income[desc] = Math.round(amt)
      totalIncome += amt
    }
    for (const [desc, amt] of b.expense) {
      expense[desc] = Math.round(amt)
      totalExpense += amt
    }

    return {
      time: bt,
      gameDate: formatGameDate(bt, startYear),
      income,
      expense,
      net: Math.round(totalIncome - totalExpense)
    }
  })

  return {
    mineralId,
    mineralName: MINERAL_NAMES[mineralId] || `Mineral ${mineralId}`,
    resolution,
    series
  }
}

export async function getMineralColonies(query: QueryFn, ctx: GameCtx): Promise<MineralColony[]> {
  // FCT_SystemBody is empty via bridge, so we can't resolve system names through joins.
  // Just get colony names directly.
  const rows = await query<{ PopulationID: number; PopName: string }>(
    `SELECT DISTINCT rmd.PopulationID, p.PopName
    FROM FCT_RaceMineralData rmd
    LEFT JOIN FCT_Population p ON rmd.PopulationID = p.PopulationID AND p.GameID = ${ctx.gameId}
    WHERE rmd.GameID = ${ctx.gameId} AND rmd.RaceID = ${ctx.raceId}
    ORDER BY p.PopName`
  )

  return rows.map((r) => ({
    populationId: r.PopulationID,
    name: r.PopName || 'Unknown',
    system: ''
  }))
}
