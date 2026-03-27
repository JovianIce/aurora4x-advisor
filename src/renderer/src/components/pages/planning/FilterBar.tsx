import { useState, useEffect } from 'react'
import { SearchPicker } from './SearchPicker'

// --- Types ---

export interface FilterCondition {
  id: string
  field: string
  operator: 'lt' | 'gt' | 'eq' | 'neq' | 'contains' | 'not_contains'
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

const MAX_BAR_ITEMS = 5

// --- Constants ---

const FIELDS = [
  { value: 'fuelPct', label: 'Fuel %', type: 'number', desc: '' },
  { value: 'deploymentRemaining', label: 'Deploy Left (mo)', type: 'number', desc: '' },
  { value: 'monthsSinceOverhaul', label: 'Since Overhaul (mo)', type: 'number', desc: '' },
  { value: 'maintenanceState', label: 'Maint State', type: 'number', desc: '' },
  { value: 'rangeDays', label: 'Range (days)', type: 'number', desc: '' },
  { value: 'speed', label: 'Speed (km/s)', type: 'number', desc: '' },
  { value: 'className', label: 'Class', type: 'string', desc: '' },
  { value: 'fleet', label: 'Fleet', type: 'string', desc: '' },
  { value: 'system', label: 'System', type: 'string', desc: '' },
  { value: 'name', label: 'Ship Name', type: 'string', desc: '' },
  { value: 'jumpsToSol', label: 'Jumps to Sol', type: 'number', desc: '' },
  { value: 'travelDaysToSol', label: 'Days to Sol', type: 'number', desc: '' },
  { value: 'military', label: 'Military', type: 'boolean', desc: 'Classification' },
  { value: 'commercial', label: 'Commercial', type: 'boolean', desc: 'Classification' },
  { value: 'fighter', label: 'Fighter', type: 'boolean', desc: 'Classification' },
  { value: 'tanker', label: 'Tanker', type: 'boolean', desc: 'Fuel tanker flag (class design)' },
  {
    value: 'freighter',
    label: 'Freighter',
    type: 'boolean',
    desc: 'Cargo > 25% of tonnage (derived)'
  }
] as const

const NUM_OPS = [
  { value: 'lt', label: '<' },
  { value: 'gt', label: '>' },
  { value: 'eq', label: '=' },
  { value: 'neq', label: '≠' }
]
const STR_OPS = [
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: '!contains' },
  { value: 'eq', label: '=' },
  { value: 'neq', label: '≠' }
]
const BOOL_OPS = [
  { value: 'eq', label: 'is' },
  { value: 'neq', label: 'is not' }
]

// --- Built-in presets ---

const BUILT_IN_PRESETS: FilterPreset[] = [
  {
    name: 'Needs Attention',
    builtIn: true,
    groups: [
      {
        id: 'g1',
        conditions: [
          { id: '1', field: 'commercial', operator: 'neq', value: 'true', enabled: true },
          { id: '2', field: 'deploymentRemaining', operator: 'lt', value: 10, enabled: true }
        ]
      },
      {
        id: 'g2',
        conditions: [{ id: '3', field: 'fuelPct', operator: 'lt', value: 20, enabled: true }]
      }
    ]
  },
  {
    name: 'Low Fuel (excl. tankers)',
    builtIn: true,
    groups: [
      {
        id: 'g1',
        conditions: [
          { id: '1', field: 'fuelPct', operator: 'lt', value: 50, enabled: true },
          {
            id: '2',
            field: 'className',
            operator: 'not_contains',
            value: 'Calabria',
            enabled: true
          }
        ]
      }
    ]
  },
  {
    name: 'Critical Deploy',
    builtIn: true,
    groups: [
      {
        id: 'g1',
        conditions: [
          { id: '1', field: 'deploymentRemaining', operator: 'lt', value: 6, enabled: true },
          { id: '2', field: 'commercial', operator: 'neq', value: 'true', enabled: true }
        ]
      }
    ]
  },
  {
    name: 'Maint Issues',
    builtIn: true,
    groups: [
      {
        id: 'g1',
        conditions: [
          { id: '1', field: 'maintenanceState', operator: 'gt', value: 0, enabled: true }
        ]
      }
    ]
  }
]

// --- Persistence via IPC (file-backed in AppData) ---

async function loadSaved(): Promise<FilterPreset[]> {
  return window.api.fleetFilters.load() as Promise<FilterPreset[]>
}
function saveSaved(p: FilterPreset[]): void {
  window.api.fleetFilters.save(p)
}

let _id = Date.now()
function nid(): string {
  return String(++_id)
}

function newCondition(): FilterCondition {
  return { id: nid(), field: 'fuelPct', operator: 'lt', value: 50, enabled: true }
}
function newGroup(): FilterGroup {
  return { id: nid(), conditions: [newCondition()] }
}

// --- FilterBar ---

interface FilterBarProps {
  groups: FilterGroup[]
  onChange: (groups: FilterGroup[]) => void
}

export function FilterBar({ groups, onChange }: FilterBarProps): React.JSX.Element {
  const [showModal, setShowModal] = useState(false)
  const [activeName, setActiveName] = useState<string | null>(null)
  const [savedPresets, setSavedPresets] = useState<FilterPreset[]>([])
  useEffect(() => {
    loadSaved().then(setSavedPresets)
  }, [])
  const allPresets = [...BUILT_IN_PRESETS, ...savedPresets]
  const barPresets = allPresets.filter((p) => p.builtIn || p.showOnBar).slice(0, MAX_BAR_ITEMS)

  const applyPreset = (p: FilterPreset): void => {
    onChange(
      p.groups.map((g) => ({
        ...g,
        id: nid(),
        conditions: g.conditions.map((c) => ({ ...c, id: nid() }))
      }))
    )
    setActiveName(p.name)
  }

  const clear = (): void => {
    onChange([])
    setActiveName(null)
  }

  const activeCount = groups.reduce((n, g) => n + g.conditions.filter((c) => c.enabled).length, 0)

  return (
    <>
      <div className="flex items-center gap-1 flex-wrap">
        <span
          style={{
            fontSize: 9,
            color: 'var(--cic-cyan-dim)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginRight: 2
          }}
        >
          Filters{' '}
          <span
            onClick={() => setShowModal(true)}
            className="cursor-pointer"
            style={{
              color: 'var(--cic-cyan)',
              fontWeight: 400,
              textTransform: 'none',
              letterSpacing: 'normal',
              textDecoration: 'underline'
            }}
          >
            (manage)
          </span>
          :
        </span>
        {barPresets.map((p) => (
          <Pill
            key={p.name}
            label={p.name}
            active={activeName === p.name && groups.length > 0}
            onClick={() => applyPreset(p)}
          />
        ))}
        {activeCount > 0 && (
          <button
            onClick={clear}
            className="cursor-pointer"
            style={{
              fontSize: 9,
              border: 'none',
              background: 'transparent',
              padding: '0 4px',
              color: 'var(--cic-red)'
            }}
          >
            × Clear ({activeCount})
          </button>
        )}
      </div>
      {showModal && (
        <FilterModal
          groups={groups}
          onApply={(g, name) => {
            onChange(g)
            setActiveName(name)
            setShowModal(false)
            loadSaved().then(setSavedPresets)
          }}
          onClose={() => {
            setShowModal(false)
            loadSaved().then(setSavedPresets)
          }}
        />
      )}
    </>
  )
}

function Pill({
  label,
  active,
  accent,
  onClick
}: {
  label: string
  active: boolean
  accent?: boolean
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      className="rounded cursor-pointer transition-colors"
      style={{
        padding: '2px 6px',
        fontSize: 9,
        border: `1px solid ${active ? 'var(--cic-cyan)' : accent ? 'var(--cic-cyan)' : 'var(--cic-panel-edge)'}`,
        background: active ? 'rgba(0,229,255,0.1)' : 'transparent',
        color: active ? 'var(--cic-cyan)' : accent ? 'var(--cic-cyan)' : 'var(--cic-cyan-dim)'
      }}
    >
      {label}
    </button>
  )
}

// --- Modal ---

function FilterModal({
  groups: initGroups,
  onApply,
  onClose
}: {
  groups: FilterGroup[]
  onApply: (groups: FilterGroup[], name: string | null) => void
  onClose: () => void
}): React.JSX.Element {
  const [saved, setSaved] = useState<FilterPreset[]>([])
  useEffect(() => {
    loadSaved().then(setSaved)
  }, [])
  const [groups, setGroups] = useState<FilterGroup[]>(
    initGroups.length > 0 ? initGroups : [newGroup()]
  )
  const [saveName, setSaveName] = useState('')
  const [tab, setTab] = useState<'build' | 'saved'>('build')

  const updateGroup = (gid: string, conditions: FilterCondition[]): void =>
    setGroups(groups.map((g) => (g.id === gid ? { ...g, conditions } : g)))

  const addGroup = (): void => setGroups([...groups, newGroup()])
  const removeGroup = (gid: string): void => setGroups(groups.filter((g) => g.id !== gid))

  const addCondition = (gid: string): void =>
    updateGroup(gid, [...(groups.find((g) => g.id === gid)?.conditions || []), newCondition()])

  const updateCondition = (gid: string, cid: string, patch: Partial<FilterCondition>): void =>
    updateGroup(
      gid,
      (groups.find((g) => g.id === gid)?.conditions || []).map((c) =>
        c.id === cid ? { ...c, ...patch } : c
      )
    )

  const removeCondition = (gid: string, cid: string): void =>
    updateGroup(
      gid,
      (groups.find((g) => g.id === gid)?.conditions || []).filter((c) => c.id !== cid)
    )

  const save = (): void => {
    if (!saveName.trim()) return
    const preset: FilterPreset = { name: saveName.trim(), groups }
    const up = [...saved.filter((p) => p.name !== preset.name), preset]
    setSaved(up)
    saveSaved(up)
    setSaveName('')
  }

  const deleteSaved = (name: string): void => {
    const up = saved.filter((p) => p.name !== name)
    setSaved(up)
    saveSaved(up)
  }

  const toggleBar = (name: string): void => {
    const up = saved.map((p) => (p.name === name ? { ...p, showOnBar: !p.showOnBar } : p))
    setSaved(up)
    saveSaved(up)
  }

  const loadPreset = (p: FilterPreset): void => {
    setGroups(
      p.groups.map((g) => ({
        ...g,
        id: nid(),
        conditions: g.conditions.map((c) => ({ ...c, id: nid() }))
      }))
    )
    setTab('build')
  }

  const ss: React.CSSProperties = {
    fontSize: 9,
    padding: '2px 4px',
    background: 'var(--cic-panel)',
    border: '1px solid var(--cic-panel-edge)',
    borderRadius: 3,
    color: 'var(--foreground)'
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--cic-deep)',
          border: '1px solid var(--cic-panel-edge)',
          borderRadius: 8,
          width: 560,
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            borderBottom: '1px solid var(--cic-panel-edge)'
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--cic-cyan)' }}>
            Filter Builder
          </span>
          <div className="flex gap-1">
            <TabBtn label="Build" active={tab === 'build'} onClick={() => setTab('build')} />
            <TabBtn
              label={`Saved (${saved.length})`}
              active={tab === 'saved'}
              onClick={() => setTab('saved')}
            />
          </div>
          <button
            onClick={onClose}
            className="cursor-pointer"
            style={{
              fontSize: 14,
              border: 'none',
              background: 'transparent',
              color: 'var(--cic-cyan-dim)'
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
          {tab === 'build' && (
            <div>
              <div style={{ fontSize: 9, color: 'var(--cic-cyan-dim)', marginBottom: 6 }}>
                Groups are OR&apos;d together. Conditions within a group are AND&apos;d.
              </div>
              {groups.map((g, gi) => (
                <div key={g.id}>
                  {gi > 0 && (
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: 'var(--cic-amber)',
                        textAlign: 'center',
                        padding: '4px 0'
                      }}
                    >
                      OR
                    </div>
                  )}
                  <div
                    style={{
                      border: '1px solid var(--cic-panel-edge)',
                      borderRadius: 6,
                      padding: 8,
                      marginBottom: 2,
                      background: 'var(--cic-panel)'
                    }}
                  >
                    <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
                      <span
                        style={{
                          fontSize: 9,
                          color: 'var(--cic-cyan-dim)',
                          textTransform: 'uppercase'
                        }}
                      >
                        Group {gi + 1}
                      </span>
                      {groups.length > 1 && (
                        <button
                          onClick={() => removeGroup(g.id)}
                          className="cursor-pointer"
                          style={{
                            fontSize: 9,
                            border: 'none',
                            background: 'transparent',
                            color: 'var(--cic-cyan-dim)'
                          }}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    {g.conditions.map((c, ci) => (
                      <div key={c.id}>
                        {ci > 0 && (
                          <div
                            style={{
                              fontSize: 9,
                              color: 'var(--cic-cyan)',
                              padding: '1px 0 1px 20px'
                            }}
                          >
                            AND
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={c.enabled}
                            onChange={(e) =>
                              updateCondition(g.id, c.id, { enabled: e.target.checked })
                            }
                            style={{ accentColor: 'var(--cic-cyan)' }}
                          />
                          <button
                            onClick={() => updateCondition(g.id, c.id, { negate: !c.negate })}
                            className="cursor-pointer hover:brightness-125"
                            title="Negate this condition"
                            style={{
                              fontSize: 9,
                              padding: '0 3px',
                              borderRadius: 3,
                              minWidth: 24,
                              textAlign: 'center',
                              fontWeight: 600,
                              border: c.negate
                                ? '1px solid var(--cic-red)'
                                : '1px dashed var(--cic-panel-edge)',
                              background: c.negate ? 'rgba(255,23,68,0.15)' : 'transparent',
                              color: c.negate ? 'var(--cic-red)' : 'var(--cic-cyan-dim)'
                            }}
                          >
                            NOT
                          </button>
                          <SearchPicker
                            title="Select Field"
                            placeholder={
                              FIELDS.find((f) => f.value === c.field)?.label || 'Field...'
                            }
                            value={c.field}
                            onSelect={(id) => {
                              const f = FIELDS.find((ff) => ff.value === id)
                              updateCondition(g.id, c.id, {
                                field: String(id),
                                operator: (f?.type === 'number'
                                  ? 'lt'
                                  : 'contains') as FilterCondition['operator']
                              })
                            }}
                            items={FIELDS.map((f) => ({
                              id: f.value,
                              label: f.label,
                              sub: f.desc || undefined,
                              group:
                                f.type === 'number'
                                  ? 'Numeric'
                                  : f.type === 'boolean'
                                    ? 'Flags'
                                    : 'Text'
                            }))}
                          />
                          <select
                            value={c.operator}
                            onChange={(e) =>
                              updateCondition(g.id, c.id, {
                                operator: e.target.value as FilterCondition['operator']
                              })
                            }
                            style={ss}
                          >
                            {(FIELDS.find((f) => f.value === c.field)?.type === 'number'
                              ? NUM_OPS
                              : FIELDS.find((f) => f.value === c.field)?.type === 'boolean'
                                ? BOOL_OPS
                                : STR_OPS
                            ).map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                          {FIELDS.find((f) => f.value === c.field)?.type === 'boolean' ? (
                            <select
                              value={String(c.value)}
                              onChange={(e) =>
                                updateCondition(g.id, c.id, { value: e.target.value })
                              }
                              style={ss}
                            >
                              <option value="true">true</option>
                              <option value="false">false</option>
                            </select>
                          ) : (
                            <input
                              type={
                                FIELDS.find((f) => f.value === c.field)?.type === 'number'
                                  ? 'number'
                                  : 'text'
                              }
                              value={c.value}
                              onChange={(e) =>
                                updateCondition(g.id, c.id, {
                                  value:
                                    FIELDS.find((f) => f.value === c.field)?.type === 'number'
                                      ? Number(e.target.value)
                                      : e.target.value
                                })
                              }
                              style={{
                                ...ss,
                                width:
                                  FIELDS.find((f) => f.value === c.field)?.type === 'number'
                                    ? 50
                                    : 80
                              }}
                            />
                          )}
                          <button
                            onClick={() => removeCondition(g.id, c.id)}
                            className="cursor-pointer"
                            style={{
                              fontSize: 9,
                              border: 'none',
                              background: 'transparent',
                              color: 'var(--cic-cyan-dim)'
                            }}
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ))}
                    <button
                      onClick={() => addCondition(g.id)}
                      className="cursor-pointer"
                      style={{
                        fontSize: 9,
                        border: 'none',
                        background: 'transparent',
                        marginTop: 4,
                        color: 'var(--cic-cyan)'
                      }}
                    >
                      + condition
                    </button>
                  </div>
                </div>
              ))}
              <button
                onClick={addGroup}
                className="cursor-pointer"
                style={{
                  fontSize: 10,
                  border: '1px dashed var(--cic-amber)',
                  borderRadius: 6,
                  background: 'transparent',
                  padding: '4px 8px',
                  marginTop: 4,
                  width: '100%',
                  color: 'var(--cic-amber)'
                }}
              >
                + OR Group
              </button>

              {/* Save */}
              <div
                style={{
                  marginTop: 12,
                  display: 'flex',
                  gap: 4,
                  alignItems: 'center'
                }}
              >
                <input
                  type="text"
                  placeholder="Preset name..."
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && save()}
                  className="focus:outline-none"
                  style={{ flex: 1, ...ss, padding: '4px 8px' }}
                />
                <button
                  onClick={save}
                  className="cursor-pointer"
                  style={{
                    ...ss,
                    padding: '4px 8px',
                    border: '1px solid var(--cic-cyan)',
                    background: 'rgba(0,229,255,0.1)',
                    color: 'var(--cic-cyan)'
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          )}

          {tab === 'saved' && (
            <div className="flex flex-col gap-1">
              {BUILT_IN_PRESETS.map((p) => (
                <PresetRow key={p.name} preset={p} onLoad={loadPreset} />
              ))}
              {saved.length > 0 && (
                <div
                  style={{
                    fontSize: 9,
                    color: 'var(--cic-cyan-dim)',
                    textTransform: 'uppercase',
                    marginTop: 8
                  }}
                >
                  Custom
                </div>
              )}
              {saved.map((p) => (
                <PresetRow
                  key={p.name}
                  preset={p}
                  onLoad={loadPreset}
                  onDelete={() => deleteSaved(p.name)}
                  onToggleBar={() => toggleBar(p.name)}
                />
              ))}
              {saved.length === 0 && (
                <div style={{ fontSize: 10, color: 'var(--cic-cyan-dim)', marginTop: 8 }}>
                  No custom presets. Build and save one.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 4,
            padding: '8px 12px',
            borderTop: '1px solid var(--cic-panel-edge)'
          }}
        >
          <button
            onClick={onClose}
            className="cursor-pointer"
            style={{ ...ss, padding: '4px 12px', color: 'var(--cic-cyan-dim)' }}
          >
            Cancel
          </button>
          <button
            onClick={() => onApply(groups, null)}
            className="cursor-pointer"
            style={{
              fontSize: 10,
              padding: '4px 12px',
              border: '1px solid var(--cic-cyan)',
              borderRadius: 4,
              background: 'var(--cic-cyan)',
              color: 'var(--cic-deep)',
              fontWeight: 600
            }}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  )
}

function TabBtn({
  label,
  active,
  onClick
}: {
  label: string
  active: boolean
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      className="cursor-pointer transition-colors"
      style={{
        fontSize: 10,
        padding: '2px 8px',
        borderRadius: 4,
        border: 'none',
        background: active ? 'rgba(0,229,255,0.1)' : 'transparent',
        color: active ? 'var(--cic-cyan)' : 'var(--cic-cyan-dim)',
        fontWeight: active ? 600 : 400
      }}
    >
      {label}
    </button>
  )
}

function PresetRow({
  preset,
  onLoad,
  onDelete,
  onToggleBar
}: {
  preset: FilterPreset
  onLoad: (p: FilterPreset) => void
  onDelete?: () => void
  onToggleBar?: () => void
}): React.JSX.Element {
  const summary = preset.groups
    .map(
      (g, i) =>
        (i > 0 ? 'OR ' : '') +
        g.conditions
          .map((c) => {
            const f = FIELDS.find((ff) => ff.value === c.field)
            return `${c.negate ? 'NOT ' : ''}${f?.label || c.field} ${c.operator} ${c.value}`
          })
          .join(' AND ')
    )
    .join(' ')

  return (
    <div
      className="flex items-center gap-2 rounded transition-colors cursor-pointer"
      style={{
        padding: '4px 8px',
        border: '1px solid var(--cic-panel-edge)',
        borderRadius: 4
      }}
      onClick={() => onLoad(preset)}
    >
      <div className="flex-1 min-w-0">
        <div style={{ fontSize: 10, fontWeight: 500 }}>{preset.name}</div>
        <div style={{ fontSize: 9, color: 'var(--cic-cyan-dim)' }} className="truncate">
          {summary}
        </div>
      </div>
      {onToggleBar && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggleBar()
          }}
          className="cursor-pointer"
          title={preset.showOnBar ? 'Hide from bar' : 'Show on bar'}
          style={{
            fontSize: 8,
            padding: '1px 4px',
            borderRadius: 3,
            border: `1px solid ${preset.showOnBar ? 'var(--cic-cyan)' : 'var(--cic-panel-edge)'}`,
            background: preset.showOnBar ? 'rgba(0,229,255,0.1)' : 'transparent',
            color: preset.showOnBar ? 'var(--cic-cyan)' : 'var(--cic-cyan-dim)'
          }}
        >
          {preset.showOnBar ? 'On bar' : 'Pin'}
        </button>
      )}
      {preset.builtIn && (
        <span style={{ fontSize: 9, color: 'var(--cic-cyan-dim)', opacity: 0.5 }}>built-in</span>
      )}
      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="cursor-pointer"
          style={{
            fontSize: 10,
            border: 'none',
            background: 'transparent',
            color: 'var(--cic-cyan-dim)'
          }}
        >
          ×
        </button>
      )}
    </div>
  )
}

// --- Summary ---

const OP_LABELS: Record<string, string> = {
  lt: '<',
  gt: '>',
  eq: '=',
  neq: '≠',
  contains: '∋',
  not_contains: '∌'
}

// eslint-disable-next-line react-refresh/only-export-components
export function summarizeGroups(groups: FilterGroup[]): string {
  const activeGroups = groups.filter((g) => g.conditions.some((c) => c.enabled))
  if (activeGroups.length === 0) return ''
  return activeGroups
    .map((g, i) => {
      const conds = g.conditions
        .filter((c) => c.enabled)
        .map((c) => {
          const f = FIELDS.find((ff) => ff.value === c.field)
          const op = OP_LABELS[c.operator] || c.operator
          return `${c.negate ? 'NOT ' : ''}${f?.label || c.field} ${op} ${c.value}`
        })
        .join('  AND  ')
      return i > 0 ? `OR  ${conds}` : conds
    })
    .join('  ')
}

// --- Evaluator ---

// eslint-disable-next-line react-refresh/only-export-components
export function applyGroupFilters<T extends Record<string, unknown>>(
  items: T[],
  groups: FilterGroup[]
): T[] {
  if (groups.length === 0) return items
  const activeGroups = groups.filter((g) => g.conditions.some((c) => c.enabled))
  if (activeGroups.length === 0) return items

  return items.filter((item) =>
    activeGroups.some((g) =>
      g.conditions
        .filter((c) => c.enabled)
        .every((c) => {
          const raw = item[c.field]
          if (raw == null) return c.negate ? true : false
          let result: boolean
          switch (c.operator) {
            case 'lt':
              result = Number(raw) < Number(c.value)
              break
            case 'gt':
              result = Number(raw) > Number(c.value)
              break
            case 'eq':
              result = String(raw).toLowerCase() === String(c.value).toLowerCase()
              break
            case 'neq':
              result = String(raw).toLowerCase() !== String(c.value).toLowerCase()
              break
            case 'contains':
              result = String(raw).toLowerCase().includes(String(c.value).toLowerCase())
              break
            case 'not_contains':
              result = !String(raw).toLowerCase().includes(String(c.value).toLowerCase())
              break
            default:
              result = true
          }
          return c.negate ? !result : result
        })
    )
  )
}
