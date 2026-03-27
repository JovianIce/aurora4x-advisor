import React, { useState, useMemo } from 'react'
import {
  useResearchOverview,
  type TechNode,
  type ResearchProject,
  type TechCategory
} from '@renderer/hooks/use-data'
import { SectionHeader } from './ui'

export function ResearchTab({ active = true }: { active?: boolean } = {}): React.JSX.Element {
  const { data, isLoading, error } = useResearchOverview(active)

  const savedResearch = (() => {
    try { return JSON.parse(localStorage.getItem('aurora-planning-research') || '{}') }
    catch { return {} }
  })()
  const saveResearch = (patch: Record<string, unknown>): void => {
    try {
      const prev = JSON.parse(localStorage.getItem('aurora-planning-research') || '{}')
      localStorage.setItem('aurora-planning-research', JSON.stringify({ ...prev, ...patch }))
    } catch { /* ignore */ }
  }

  const [selectedField, setSelectedFieldRaw] = useState<number | null>(savedResearch.selectedField ?? null)
  const [searchTerm, setSearchTerm] = useState('')
  const [showFilter, setShowFilterRaw] = useState<'all' | 'researched' | 'available'>(savedResearch.showFilter || 'available')
  const [selectedTech, setSelectedTech] = useState<TechNode | null>(null)

  const setSelectedCategory = (v: number | null): void => { setSelectedFieldRaw(v); saveResearch({ selectedField: v }) }
  const setShowFilter = (v: 'all' | 'researched' | 'available'): void => { setShowFilterRaw(v); saveResearch({ showFilter: v }) }

  if (isLoading)
    return (
      <div className="flex items-center justify-center h-full" style={{ color: 'var(--cic-cyan-dim)' }}>
        Loading tech tree...
      </div>
    )
  if (error)
    return (
      <div className="flex items-center justify-center h-full" style={{ color: 'var(--cic-red)' }}>
        Bridge error. Is Aurora running?
      </div>
    )
  if (!data) return <div />

  return (
    <div className="flex h-full">
      {/* Left: categories + active projects */}
      <div
        style={{
          width: 260,
          minWidth: 260,
          borderRight: '1px solid var(--cic-panel-edge)',
          overflow: 'auto',
          padding: 10
        }}
      >
        {/* Active research */}
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--cic-cyan)', marginBottom: 8 }}>
          Research
        </div>

        {data.projects.length > 0 && (
          <>
            <SectionHeader>Active Projects</SectionHeader>
            {data.projects.map((p) => (
              <ProjectCard key={p.projectId} project={p} />
            ))}
          </>
        )}

        <SectionHeader>Categories</SectionHeader>
        <div
          className="cursor-pointer"
          onClick={() => setSelectedCategory(null)}
          style={{
            padding: '3px 6px',
            marginBottom: 1,
            borderRadius: 3,
            fontSize: 9,
            background: selectedField === null ? 'rgba(0,229,255,0.1)' : 'transparent',
            color: selectedField === null ? 'var(--cic-cyan)' : 'var(--cic-cyan-dim)',
            fontWeight: selectedField === null ? 600 : 400
          }}
        >
          All Known ({data.techs.filter((t) => t.researched || t.researchable).length})
        </div>
        {data.categories.map((cat) => (
          <CategoryRow
            key={cat.id}
            category={cat}
            selected={selectedField === cat.id}
            onClick={() => setSelectedCategory(cat.id)}
          />
        ))}
      </div>

      {/* Center: tech list */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div
          className="flex items-center gap-2 px-2 py-1 shrink-0"
          style={{ borderBottom: '1px solid var(--cic-panel-edge)' }}
        >
          <input
            type="text"
            placeholder="Search techs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="focus:outline-none"
            style={{
              fontSize: 9,
              padding: '2px 6px',
              background: 'var(--cic-panel)',
              border: '1px solid var(--cic-panel-edge)',
              borderRadius: 3,
              color: 'var(--cic-cyan)',
              width: 160
            }}
          />
          <div className="flex gap-1">
            {(['all', 'researched', 'available'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setShowFilter(f)}
                className="cursor-pointer capitalize"
                style={{
                  padding: '2px 6px',
                  fontSize: 8,
                  borderRadius: 3,
                  border: 'none',
                  background: showFilter === f ? 'var(--cic-cyan)' : 'transparent',
                  color: showFilter === f ? 'var(--cic-deep)' : 'var(--cic-cyan-dim)',
                  fontWeight: showFilter === f ? 600 : 400
                }}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Tech list */}
        <TechList
          techs={data.techs}
          fieldFilter={selectedField}
          searchTerm={searchTerm}
          showFilter={showFilter}
          selectedTech={selectedTech}
          onSelectTech={setSelectedTech}
        />
      </div>

      {/* Right: tech detail */}
      <div
        style={{
          width: 280,
          minWidth: 280,
          borderLeft: '1px solid var(--cic-panel-edge)',
          overflow: 'auto',
          padding: 10
        }}
      >
        {selectedTech ? (
          <TechDetail tech={selectedTech} allTechs={data.techs} />
        ) : (
          <div
            className="flex items-center justify-center h-full"
            style={{ fontSize: 10, color: 'var(--cic-cyan-dim)' }}
          >
            Select a tech to view details
          </div>
        )}
      </div>
    </div>
  )
}

// --- Active project card ---

function ProjectCard({ project }: { project: ResearchProject }): React.JSX.Element {
  const pct = project.percentComplete
  const barColor = project.paused
    ? 'var(--cic-amber)'
    : 'var(--cic-cyan)'

  return (
    <div
      style={{
        background: 'var(--cic-panel)',
        border: '1px solid var(--cic-panel-edge)',
        borderRadius: 4,
        padding: 6,
        marginBottom: 4
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 600, marginBottom: 2 }}>
        {project.techName}
        {project.paused && (
          <span style={{ color: 'var(--cic-amber)', fontSize: 8, marginLeft: 4 }}>PAUSED</span>
        )}
      </div>
      <div style={{ fontSize: 8, color: 'var(--cic-cyan-dim)', marginBottom: 3 }}>
        {project.fieldName} · {project.labs} labs · {project.colony}
      </div>
      {/* Progress bar */}
      <div
        style={{
          height: 4,
          background: 'var(--cic-panel-edge)',
          borderRadius: 999,
          overflow: 'hidden',
          marginBottom: 2
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: barColor,
            borderRadius: 999,
            transition: 'width 0.3s'
          }}
        />
      </div>
      <div className="flex justify-between" style={{ fontSize: 8, color: 'var(--cic-cyan-dim)' }}>
        <span>{pct}% complete</span>
        <span>{project.pointsRemaining.toLocaleString()} RP remaining</span>
      </div>
    </div>
  )
}

// --- Category row ---

function CategoryRow({
  category,
  selected,
  onClick
}: {
  category: TechCategory
  selected: boolean
  onClick: () => void
}): React.JSX.Element {
  const pct = category.total > 0 ? Math.round((category.researched / category.total) * 100) : 0

  return (
    <div
      className="cursor-pointer"
      onClick={onClick}
      style={{
        padding: '3px 6px',
        marginBottom: 1,
        borderRadius: 3,
        fontSize: 9,
        background: selected ? 'rgba(0,229,255,0.1)' : 'transparent',
        color: selected ? 'var(--cic-cyan)' : 'var(--foreground)'
      }}
    >
      <div className="flex justify-between items-center">
        <span style={{ fontWeight: selected ? 600 : 400 }}>{category.name}</span>
        <span style={{ fontSize: 8, color: 'var(--cic-cyan-dim)' }}>
          {category.researched}/{category.total}
        </span>
      </div>
      <div
        style={{
          height: 2,
          background: 'var(--cic-panel-edge)',
          borderRadius: 999,
          marginTop: 2,
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: 'var(--cic-green)',
            borderRadius: 999
          }}
        />
      </div>
    </div>
  )
}

// --- Tech list ---

function TechList({
  techs,
  fieldFilter,
  searchTerm,
  showFilter,
  selectedTech,
  onSelectTech
}: {
  techs: TechNode[]
  fieldFilter: number | null
  searchTerm: string
  showFilter: 'all' | 'researched' | 'available'
  selectedTech: TechNode | null
  onSelectTech: (t: TechNode) => void
}): React.JSX.Element {
  const filtered = useMemo(() => {
    let result = techs
    if (fieldFilter != null) result = result.filter((t) => t.fieldId === fieldFilter)
    if (searchTerm) {
      const lower = searchTerm.toLowerCase()
      result = result.filter(
        (t) => t.name.toLowerCase().includes(lower) || t.description.toLowerCase().includes(lower)
      )
    }
    // Fog of war: never show locked techs (unknown to the player)
    result = result.filter((t) => t.researched || t.researchable)
    if (showFilter === 'researched') result = result.filter((t) => t.researched)
    else if (showFilter === 'available') result = result.filter((t) => t.researchable)
    // Sort: available first, then researched by completion date (recent first), then by cost
    result = [...result].sort((a, b) => {
      // Available before researched
      if (a.researchable && !b.researchable) return -1
      if (!a.researchable && b.researchable) return 1
      // Both researched: sort by completion date descending (recent first)
      if (a.researched && b.researched) {
        const aTime = a.completedTime ?? 0
        const bTime = b.completedTime ?? 0
        if (aTime !== bTime) return bTime - aTime
      }
      // Fallback: by cost
      return a.cost - b.cost
    })
    return result
  }, [techs, fieldFilter, searchTerm, showFilter])

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full border-collapse">
        <thead className="sticky top-0 z-10" style={{ background: 'var(--cic-deep)' }}>
          <tr>
            <th style={thStyle}>Status</th>
            <th style={thStyle}>Tech</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Cost</th>
            <th style={thStyle}>Field</th>
            <th style={thStyle}>Completed</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((tech) => {
            const isSelected = selectedTech?.id === tech.id
            return (
              <tr
                key={tech.id}
                onClick={() => onSelectTech(tech)}
                className="cursor-pointer"
                style={{
                  background: isSelected ? 'rgba(0,229,255,0.08)' : undefined
                }}
                onMouseEnter={(e) => {
                  if (!isSelected)
                    (e.currentTarget as HTMLElement).style.background = 'rgba(0,229,255,0.04)'
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) (e.currentTarget as HTMLElement).style.background = ''
                }}
              >
                <td style={tdStyle}>
                  <StatusBadge tech={tech} />
                </td>
                <td style={{ ...tdStyle, fontWeight: 500 }}>{tech.name}</td>
                <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--cic-cyan-dim)' }}>
                  {tech.cost.toLocaleString()}
                </td>
                <td style={{ ...tdStyle, color: 'var(--cic-cyan-dim)' }}>{tech.fieldName}</td>
                <td style={{ ...tdStyle, color: 'var(--cic-cyan-dim)' }}>
                  {tech.completedDate || (tech.isStarting ? 'Starting' : tech.researched ? 'Unknown' : '—')}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {filtered.length === 0 && (
        <div style={{ padding: 12, fontSize: 10, color: 'var(--cic-cyan-dim)', textAlign: 'center' }}>
          No techs match filters
        </div>
      )}
    </div>
  )
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '2px 5px',
  borderBottom: '1px solid var(--cic-panel-edge)',
  fontSize: 8,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--cic-cyan)'
}

const tdStyle: React.CSSProperties = {
  padding: '1px 5px',
  borderBottom: '1px solid var(--cic-panel-edge)',
  fontSize: 9
}

function StatusBadge({ tech }: { tech: TechNode }): React.JSX.Element {
  if (tech.researched)
    return (
      <span
        style={{
          fontSize: 7,
          padding: '1px 3px',
          borderRadius: 3,
          background: 'rgba(0,230,118,0.15)',
          color: 'var(--cic-green)',
          fontWeight: 600
        }}
      >
        DONE
      </span>
    )
  if (tech.researchable)
    return (
      <span
        style={{
          fontSize: 7,
          padding: '1px 3px',
          borderRadius: 3,
          background: 'rgba(0,229,255,0.15)',
          color: 'var(--cic-cyan)',
          fontWeight: 600
        }}
      >
        AVAIL
      </span>
    )
  return (
    <span
      style={{
        fontSize: 7,
        padding: '1px 3px',
        borderRadius: 3,
        background: 'rgba(255,179,0,0.1)',
        color: 'var(--cic-amber-dim)',
        fontWeight: 600
      }}
    >
      LOCK
    </span>
  )
}

// --- Tech detail ---

function TechDetail({
  tech,
  allTechs
}: {
  tech: TechNode
  allTechs: TechNode[]
}): React.JSX.Element {
  const techById = useMemo(() => {
    const map = new Map<number, TechNode>()
    for (const t of allTechs) map.set(t.id, t)
    return map
  }, [allTechs])

  const prereq1 = tech.prerequisite1 ? techById.get(tech.prerequisite1) : null
  const prereq2 = tech.prerequisite2 ? techById.get(tech.prerequisite2) : null

  // Find techs that require this one
  const unlockedBy = useMemo(
    () =>
      allTechs.filter(
        (t) => t.prerequisite1 === tech.id || t.prerequisite2 === tech.id
      ),
    [allTechs, tech.id]
  )

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--cic-cyan)', marginBottom: 2 }}>
        {tech.name}
      </div>
      <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
        <StatusBadge tech={tech} />
        <span style={{ fontSize: 9, color: 'var(--cic-cyan-dim)' }}>{tech.fieldName}</span>
      </div>

      {tech.description && (
        <div
          style={{
            fontSize: 9,
            color: 'var(--cic-cyan-dim)',
            marginBottom: 10,
            padding: 6,
            background: 'var(--cic-panel)',
            border: '1px solid var(--cic-panel-edge)',
            borderRadius: 4,
            lineHeight: 1.4
          }}
        >
          {tech.description}
        </div>
      )}

      <div
        className="grid grid-cols-2 gap-2"
        style={{ marginBottom: 10 }}
      >
        <MiniCard label="Research Cost" value={`${tech.cost.toLocaleString()} RP`} />
        <MiniCard label="Tech ID" value={String(tech.id)} />
      </div>

      {/* Prerequisites */}
      {(prereq1 || prereq2) && (
        <>
          <SectionHeader>Prerequisites</SectionHeader>
          <div style={{ marginBottom: 8 }}>
            {prereq1 && <PrereqChip tech={prereq1} />}
            {prereq2 && <PrereqChip tech={prereq2} />}
          </div>
        </>
      )}

      {/* Unlocks */}
      {unlockedBy.length > 0 && (
        <>
          <SectionHeader>Unlocks ({unlockedBy.length})</SectionHeader>
          <div>
            {unlockedBy.slice(0, 15).map((t) => (
              <div
                key={t.id}
                style={{
                  fontSize: 9,
                  padding: '2px 0',
                  borderBottom: '1px solid var(--cic-panel-edge)',
                  color: t.researched
                    ? 'var(--cic-green)'
                    : t.researchable
                      ? 'var(--foreground)'
                      : 'var(--cic-cyan-dim)'
                }}
              >
                {t.name}
                <span style={{ fontSize: 8, color: 'var(--cic-cyan-dim)', marginLeft: 4 }}>
                  {t.cost.toLocaleString()} RP
                </span>
              </div>
            ))}
            {unlockedBy.length > 15 && (
              <div style={{ fontSize: 8, color: 'var(--cic-cyan-dim)', padding: '4px 0' }}>
                +{unlockedBy.length - 15} more
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function PrereqChip({ tech }: { tech: TechNode }): React.JSX.Element {
  return (
    <div
      style={{
        fontSize: 9,
        padding: '3px 6px',
        marginBottom: 2,
        borderRadius: 3,
        border: `1px solid ${tech.researched ? 'var(--cic-green)' : 'var(--cic-red)'}`,
        background: tech.researched ? 'rgba(0,230,118,0.08)' : 'rgba(255,23,68,0.08)',
        color: tech.researched ? 'var(--cic-green)' : 'var(--cic-red)'
      }}
    >
      {tech.researched ? '✓' : '✗'} {tech.name}
    </div>
  )
}

function MiniCard({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div
      style={{
        background: 'var(--cic-panel)',
        border: '1px solid var(--cic-panel-edge)',
        borderRadius: 4,
        padding: '4px 6px'
      }}
    >
      <div style={{ fontSize: 7, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--cic-cyan-dim)', marginBottom: 1 }}>
        {label}
      </div>
      <div style={{ fontSize: 10, fontWeight: 600 }}>{value}</div>
    </div>
  )
}
