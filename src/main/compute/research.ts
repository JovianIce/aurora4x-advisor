import type { QueryFn, GameCtx } from './types'
import { formatGameDate } from './utils'

// DIM tables can't be queried via bridge - hardcode from DIM_ResearchField
const RESEARCH_FIELDS: Record<number, string> = {
  1: 'Power & Propulsion',
  2: 'Sensors & Control',
  3: 'Direct Fire Weapons',
  4: 'Missiles',
  5: 'Construction / Production',
  6: 'Logistics',
  7: 'Defensive Systems',
  8: 'Biology / Genetics',
  9: 'Ground Combat'
  // 10 = Component Creation -DoNotDisplay
}

// TechTypeID → FieldID mapping from DIM_TechType (bridge can't query DIM tables)
const TECH_TYPE_TO_FIELD: Record<number, number> = {
  // Field 1: Power & Propulsion
  1:1, 6:1, 7:1, 8:1, 40:1, 41:1, 42:1, 65:1, 69:1, 85:1, 111:1, 117:1, 119:1, 130:1, 166:1, 169:1, 198:1, 214:1,
  // Field 2: Sensors & Control
  2:2, 4:2, 5:2, 19:2, 20:2, 28:2, 82:2, 83:2, 87:2, 88:2, 89:2, 108:2, 112:2, 113:2, 120:2, 125:2, 126:2, 139:2, 142:2, 152:2, 165:2, 191:2, 192:2, 194:2, 242:2, 243:2, 268:2,
  // Field 3: Direct Fire Weapons
  3:3, 15:3, 60:3, 61:3, 72:3, 73:3, 75:3, 76:3, 77:3, 78:3, 106:3, 107:3, 110:3, 116:3, 118:3, 124:3, 128:3, 136:3, 137:3, 138:3, 140:3, 141:3, 143:3, 144:3, 145:3, 148:3, 149:3, 150:3, 151:3, 200:3, 208:3, 247:3,
  // Field 4: Missiles
  10:4, 12:4, 13:4, 27:4, 86:4, 104:4, 109:4, 122:4, 129:4, 163:4, 167:4, 168:4, 172:4, 202:4, 216:4, 272:4, 274:4, 275:4, 276:4, 277:4, 279:4, 280:4, 281:4, 282:4,
  // Field 5: Construction / Production
  25:5, 26:5, 29:5, 30:5, 31:5, 32:5, 56:5, 67:5, 79:5, 103:5, 158:5, 162:5, 201:5, 245:5, 248:5,
  // Field 6: Logistics
  66:6, 74:6, 80:6, 94:6, 97:6, 99:6, 100:6, 131:6, 132:6, 161:6, 164:6, 171:6, 190:6, 199:6, 203:6, 204:6, 209:6, 210:6, 211:6, 212:6, 217:6, 218:6, 225:6, 269:6, 270:6, 271:6, 285:6,
  // Field 7: Defensive Systems
  14:7, 16:7, 84:7, 92:7, 114:7, 127:7, 153:7, 154:7, 155:7, 156:7, 157:7, 204:7, 215:7,
  // Field 8: Biology / Genetics
  57:8, 64:8, 68:8, 178:8, 179:8, 180:8, 181:8, 182:8, 189:8, 197:8, 250:8, 284:8,
  // Field 9: Ground Combat
  50:9, 91:9, 170:9, 196:9, 207:9, 219:9, 220:9, 221:9, 222:9, 223:9, 226:9, 227:9, 228:9, 229:9, 230:9, 231:9, 232:9, 233:9, 234:9, 235:9, 237:9, 238:9, 239:9, 240:9, 241:9, 244:9, 246:9, 249:9, 273:9
  // Field 10: Component Creation -hidden
}

export interface TechNode {
  id: number
  name: string
  fieldId: number
  fieldName: string
  cost: number
  prerequisite1: number
  prerequisite2: number
  description: string
  researched: boolean
  researchable: boolean // all prereqs met
  raceDesigned: boolean
  isStarting: boolean // starting/conventional tech (not actively researched)
  completedTime: number | null // Aurora time seconds, null if not researched or starting
  completedDate: string | null // formatted game date
}

export interface ResearchProject {
  projectId: number
  techName: string
  fieldId: number
  fieldName: string
  totalCost: number
  labs: number
  pointsRemaining: number
  percentComplete: number
  paused: boolean
  colony: string
}

export interface TechCategory {
  id: number
  name: string
  total: number
  researched: number
}

export interface ResearchOverview {
  techs: TechNode[]
  projects: ResearchProject[]
  categories: TechCategory[]
}

export async function getResearchOverview(
  query: QueryFn,
  ctx: GameCtx
): Promise<ResearchOverview> {
  // Get base techs (RaceID=0) with TechTypeID for field mapping
  const baseTechs = await query<{
    TechSystemID: number
    Name: string
    TechTypeID: number
    DevelopCost: number
    Prerequisite1: number
    Prerequisite2: number
    TechDescription: string
    Researched: number
    StartingSystem: number
    ConventionalSystem: number
  }>(
    `SELECT ts.TechSystemID, ts.Name, ts.TechTypeID, ts.DevelopCost,
      ts.Prerequisite1, ts.Prerequisite2, ts.TechDescription,
      ts.StartingSystem, ts.ConventionalSystem,
      CASE WHEN rt.TechID IS NOT NULL THEN 1 ELSE 0 END as Researched
    FROM FCT_TechSystem ts
    LEFT JOIN FCT_RaceTech rt ON ts.TechSystemID = rt.TechID
      AND rt.GameID = ${ctx.gameId} AND rt.RaceID = ${ctx.raceId}
    WHERE (ts.GameID = 0 OR ts.GameID = ${ctx.gameId}) AND ts.RaceID = 0
    ORDER BY ts.TechTypeID, ts.DevelopCost`
  )

  // Build lookup for researched status (to check prerequisites)
  const researchedSet = new Set<number>()
  for (const t of baseTechs) {
    if (t.Researched) researchedSet.add(t.TechSystemID)
  }

  // Get start year for date formatting
  const gameRows = await query<{ StartYear: number }>(
    `SELECT StartYear FROM FCT_Game WHERE GameID = ${ctx.gameId}`
  )
  const startYear = gameRows[0]?.StartYear || 2050

  // Get research completion dates from game log (EventType 60)
  const logRows = await query<{ Time: number; MessageText: string }>(
    `SELECT Time, MessageText FROM FCT_GameLog
    WHERE GameID = ${ctx.gameId} AND RaceID = ${ctx.raceId} AND EventType = 60
    ORDER BY Time DESC
    LIMIT 2000`
  )

  // Match log entries to tech names - two formats:
  // "Research into {name} completed..."
  // "A science team led by X working on Y has completed research into {name}"
  const completionByName = new Map<string, number>()
  for (const row of logRows) {
    let techName: string | null = null
    const match1 = row.MessageText.match(/^Research into (.+?) completed/)
    const match2 = row.MessageText.match(/has completed research into (.+)$/)
    if (match1) techName = match1[1]
    else if (match2) techName = match2[1]
    if (techName && !completionByName.has(techName)) {
      completionByName.set(techName, row.Time)
    }
  }

  const techs: TechNode[] = baseTechs
    .filter((t) => {
      // Only include techs in visible research fields (exclude Field 10 / unmapped)
      const fieldId = TECH_TYPE_TO_FIELD[t.TechTypeID]
      return fieldId != null && fieldId !== 10
    })
    .map((t) => {
      const fieldId = TECH_TYPE_TO_FIELD[t.TechTypeID]!
      const prereq1Met = t.Prerequisite1 === 0 || researchedSet.has(t.Prerequisite1)
      const prereq2Met = t.Prerequisite2 === 0 || researchedSet.has(t.Prerequisite2)
      const isStarting = !!(t.StartingSystem || t.ConventionalSystem)
      const completedTime = (!isStarting && t.Researched) ? (completionByName.get(t.Name) ?? null) : null
      return {
        id: t.TechSystemID,
        name: t.Name,
        fieldId,
        fieldName: RESEARCH_FIELDS[fieldId] || `Field ${fieldId}`,
        cost: t.DevelopCost,
        prerequisite1: t.Prerequisite1,
        prerequisite2: t.Prerequisite2,
        description: t.TechDescription || '',
        researched: !!t.Researched,
        researchable: !t.Researched && prereq1Met && prereq2Met,
        raceDesigned: false,
        isStarting,
        completedTime,
        completedDate: completedTime ? formatGameDate(completedTime, startYear) : null
      }
    })

  // Get active research projects
  const projectRows = await query<{
    ProjectID: number
    TechName: string
    TechTypeID: number
    DevelopCost: number
    Labs: number
    PointsRemaining: number
    Pause: boolean
    Colony: string
  }>(
    `SELECT rp.ProjectID, ts.Name as TechName, ts.TechTypeID, ts.DevelopCost,
      rp.Facilities as Labs, rp.ResearchPointsRequired as PointsRemaining, rp.Pause,
      p.PopName as Colony
    FROM FCT_ResearchProject rp
    JOIN FCT_TechSystem ts ON rp.TechID = ts.TechSystemID
    LEFT JOIN FCT_Population p ON rp.PopulationID = p.PopulationID AND p.GameID = ${ctx.gameId}
    WHERE rp.GameID = ${ctx.gameId} AND rp.RaceID = ${ctx.raceId}`
  )

  const projects: ResearchProject[] = projectRows.map((p) => {
    const fieldId = TECH_TYPE_TO_FIELD[p.TechTypeID] || 0
    return {
      projectId: p.ProjectID,
      techName: p.TechName,
      fieldId,
      fieldName: RESEARCH_FIELDS[fieldId] || 'Unknown',
      totalCost: p.DevelopCost,
      labs: p.Labs,
      pointsRemaining: Math.round(p.PointsRemaining),
      percentComplete: p.DevelopCost > 0
        ? Math.round(((p.DevelopCost - p.PointsRemaining) / p.DevelopCost) * 100)
        : 0,
      paused: p.Pause,
      colony: p.Colony || 'Unknown'
    }
  })

  // Build field summaries -only count known techs (researched + researchable)
  const fieldMap = new Map<number, { total: number; researched: number }>()
  for (const t of techs) {
    if (!t.researched && !t.researchable) continue // fog of war
    if (!fieldMap.has(t.fieldId)) fieldMap.set(t.fieldId, { total: 0, researched: 0 })
    const c = fieldMap.get(t.fieldId)!
    c.total++
    if (t.researched) c.researched++
  }

  const categories: TechCategory[] = [...fieldMap.entries()]
    .map(([id, c]) => ({
      id,
      name: RESEARCH_FIELDS[id] || `Field ${id}`,
      total: c.total,
      researched: c.researched
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  return { techs, projects, categories }
}
