import React, { useState, useEffect } from 'react'
import {
  useMineralTotals,
  useMineralHistory,
  useMineralBreakdown,
  useMineralColonies,
  type MineralBreakdownResponse
} from '@renderer/hooks/use-data'
import { SectionHeader } from './ui'
import { SearchPicker, type PickerItem } from './SearchPicker'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid
} from 'recharts'

const MINERALS = [
  'Duranium', 'Neutronium', 'Corbomite', 'Tritanium', 'Boronide',
  'Mercassium', 'Vendarite', 'Sorium', 'Uridium', 'Corundium', 'Gallicite'
]

const MINERAL_COLORS: Record<string, string> = {
  Duranium: '#58a6ff', Neutronium: '#f85149', Corbomite: '#3fb950',
  Tritanium: '#d2a622', Boronide: '#bc8cff', Mercassium: '#f778ba',
  Vendarite: '#79c0ff', Sorium: '#ffa657', Uridium: '#8b949e',
  Corundium: '#56d4dd', Gallicite: '#e3b341'
}

const MINERAL_IDS: Record<string, number> = {
  Duranium: 1, Neutronium: 2, Corbomite: 3, Tritanium: 4, Boronide: 5,
  Mercassium: 6, Vendarite: 7, Sorium: 8, Uridium: 9, Corundium: 10, Gallicite: 11
}

type Resolution = 'raw' | 'monthly' | 'quarterly' | 'annual'

const MINERAL_STORAGE_KEY = 'aurora-planning-minerals'

function loadMineralState(): Record<string, unknown> {
  try { return JSON.parse(localStorage.getItem(MINERAL_STORAGE_KEY) || '{}') }
  catch { return {} }
}

function saveMineralState(patch: Record<string, unknown>): void {
  const prev = loadMineralState()
  localStorage.setItem(MINERAL_STORAGE_KEY, JSON.stringify({ ...prev, ...patch }))
}

export function MineralsTab({ active = true }: { active?: boolean } = {}): React.JSX.Element {
  const saved = loadMineralState()
  const [resolution, setResolutionRaw] = useState<Resolution>((saved.resolution as Resolution) || 'monthly')
  const [populationId, setPopulationIdRaw] = useState<number | null>((saved.populationId as number) ?? null)
  const [enabledMinerals, setEnabledMinerals] = useState<Set<string>>(new Set(MINERALS))
  const [selectedMineral, setSelectedMineralRaw] = useState<string | null>((saved.selectedMineral as string) || null)

  const setResolution = (v: Resolution): void => { setResolutionRaw(v); saveMineralState({ resolution: v }) }
  const setPopulationId = (v: number | null): void => { setPopulationIdRaw(v); saveMineralState({ populationId: v }) }
  const setSelectedMineral = (v: string | null): void => { setSelectedMineralRaw(v); saveMineralState({ selectedMineral: v }) }

  const { data: totalsData } = useMineralTotals(active)
  const { data: historyData, isFetching: historyLoading } = useMineralHistory(resolution, populationId, active)
  const { data: coloniesData } = useMineralColonies(active)
  const { data: breakdownData } = useMineralBreakdown(
    selectedMineral ? MINERAL_IDS[selectedMineral] : null,
    resolution,
    active
  )

  const colonies = coloniesData || []

  const toggleMineral = (m: string): void => {
    const next = new Set(enabledMinerals)
    if (next.has(m)) next.delete(m)
    else next.add(m)
    setEnabledMinerals(next)
  }

  const selectMineral = (m: string): void => {
    setSelectedMineral(selectedMineral === m ? null : m)
  }

  const ss: React.CSSProperties = {
    fontSize: 11,
    padding: '4px 8px',
    background: 'var(--cic-panel)',
    border: '1px solid var(--cic-panel-edge)',
    borderRadius: 4,
    color: 'var(--foreground)'
  }

  return (
    <div style={{ padding: 12, overflow: 'auto', height: '100%' }}>
      {/* Header + Controls */}
      <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--cic-cyan)' }}>Mineral Insights</span>
        <div className="flex items-center gap-3">
          <SearchPicker
            title="Colony Filter"
            placeholder="All colonies"
            value={populationId}
            onSelect={(id) => setPopulationId(id === 'all' ? null : Number(id))}
            items={[
              { id: 'all', label: 'All colonies' },
              ...colonies.map((c): PickerItem => ({
                id: c.populationId,
                label: c.name
              }))
            ]}
          />
          <div className="flex" style={{ gap: 1 }}>
            {(['monthly', 'quarterly', 'annual', 'raw'] as Resolution[]).map((r) => (
              <button key={r} onClick={() => setResolution(r)} className="cursor-pointer" style={{
                padding: '4px 8px', fontSize: 9, fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.05em',
                border: '1px solid var(--cic-panel-edge)',
                borderRadius: r === 'monthly' ? '4px 0 0 4px' : r === 'raw' ? '0 4px 4px 0' : 0,
                background: resolution === r ? 'var(--cic-cyan)' : 'var(--cic-panel)',
                color: resolution === r ? 'var(--cic-deep)' : 'var(--cic-cyan-dim)'
              }}>
                {r === 'raw' ? 'All' : r.slice(0, 1).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Totals bar */}
      {totalsData && <TotalsBar totals={totalsData.totals} selectedMineral={selectedMineral} onSelect={selectMineral} />}

      {/* Mineral toggle pills */}
      <div className="flex flex-wrap gap-1" style={{ marginBottom: 8, marginTop: 8 }}>
        {MINERALS.map((m) => (
          <button key={m} onClick={() => toggleMineral(m)} className="cursor-pointer" style={{
            padding: '2px 6px', fontSize: 9, borderRadius: 999,
            border: `1px solid ${MINERAL_COLORS[m]}`,
            background: enabledMinerals.has(m) ? MINERAL_COLORS[m] + '30' : 'transparent',
            color: enabledMinerals.has(m) ? MINERAL_COLORS[m] : 'var(--cic-cyan-dim)',
            opacity: enabledMinerals.has(m) ? 1 : 0.4
          }}>
            {m}
          </button>
        ))}
      </div>

      {/* Trend chart */}
      <div style={{ marginBottom: 16 }}>
        <SectionHeader>Stockpile Over Time</SectionHeader>
        <div style={{ height: 320 }}>
          {historyData && historyData.series.length > 0 ? (
            <TrendChart series={historyData.series} enabledMinerals={enabledMinerals} />
          ) : (
            <div className="flex items-center justify-center h-full" style={{ color: 'var(--cic-cyan-dim)', fontSize: 11 }}>
              {historyLoading ? <PulseText>Loading...</PulseText> : 'No data'}
            </div>
          )}
        </div>
      </div>

      {/* Selected mineral detail */}
      {selectedMineral && (
        <div className="grid grid-cols-2 gap-4" style={{ marginBottom: 16 }}>
          <div>
            <SectionHeader>{selectedMineral}: By Location</SectionHeader>
            {totalsData && <LocationBreakdown mineral={selectedMineral} byColony={totalsData.byColony} />}
          </div>
          <div>
            <SectionHeader>{selectedMineral}: Income vs Expense</SectionHeader>
            <div style={{ height: 260 }}>
              {breakdownData ? (
                <BreakdownChart data={breakdownData} />
              ) : (
                <div className="flex items-center justify-center h-full" style={{ color: 'var(--cic-cyan-dim)', fontSize: 11 }}>
                  <PulseText>Loading...</PulseText>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TotalsBar({ totals, selectedMineral, onSelect }: {
  totals: Record<string, number>; selectedMineral: string | null; onSelect: (m: string) => void
}): React.JSX.Element {
  const max = Math.max(...MINERALS.map((m) => totals[m] || 0))

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${MINERALS.length}, 1fr)`, gap: 2 }}>
      {MINERALS.map((m) => {
        const val = totals[m] || 0
        const pct = max > 0 ? (val / max) * 100 : 0
        const isSelected = selectedMineral === m

        return (
          <div key={m} onClick={() => onSelect(m)} className="cursor-pointer" style={{
            background: 'var(--cic-panel)',
            border: `1px solid ${isSelected ? MINERAL_COLORS[m] : 'var(--cic-panel-edge)'}`,
            borderRadius: 4, padding: 4, textAlign: 'center', transition: 'border-color 0.15s'
          }}>
            <div style={{ fontSize: 9, color: MINERAL_COLORS[m], fontWeight: 600, marginBottom: 2 }}>{m.slice(0, 4)}</div>
            <div style={{ fontSize: 10, fontWeight: 600 }}>{formatAmount(val)}</div>
            <div style={{ height: 3, background: 'var(--cic-panel-edge)', borderRadius: 999, marginTop: 3, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: MINERAL_COLORS[m], borderRadius: 999 }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function TrendChart({ series, enabledMinerals }: {
  series: { time: number; gameDate: string; minerals: Record<string, number> }[]
  enabledMinerals: Set<string>
}): React.JSX.Element {
  const [hoveredMineral, setHoveredMineral] = useState<string | null>(null)
  const data = series.map((s) => ({ date: s.gameDate, ...s.minerals }))
  const labelInterval = Math.max(1, Math.floor(data.length / 12))
  const active = MINERALS.filter((m) => enabledMinerals.has(m))

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart
        data={data}
        margin={{ top: 5, right: 20, bottom: 5, left: 20 }}
        onMouseLeave={() => setHoveredMineral(null)}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--cic-panel-edge)" />
        <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--cic-cyan-dim)' }} interval={labelInterval} />
        <YAxis tick={{ fontSize: 9, fill: 'var(--cic-cyan-dim)' }} tickFormatter={formatAmount} />
        <Tooltip
          contentStyle={{ background: 'var(--cic-panel)', border: '1px solid var(--cic-panel-edge)', fontSize: 10 }}
          labelStyle={{ color: 'var(--cic-cyan)', fontWeight: 600 }}
          itemSorter={(a) => -(Number(a.value) || 0)}
          formatter={(value: number, name: string) => [
            `${Number(value).toLocaleString()} L`,
            name
          ]}
        />
        <Legend
          wrapperStyle={{ fontSize: 10 }}
          onMouseEnter={(e) => setHoveredMineral(String((e as any).dataKey || (e as any).value))}
          onMouseLeave={() => setHoveredMineral(null)}
          formatter={(value: string) => (
            <span style={{
              fontWeight: hoveredMineral === value ? 700 : 400,
              textDecoration: hoveredMineral === value ? 'underline' : 'none',
              color: hoveredMineral === value ? MINERAL_COLORS[value] : undefined
            }}>
              {value}
            </span>
          )}
        />
        {active.map((m) => {
          const isHovered = hoveredMineral === m
          const isDimmed = hoveredMineral != null && !isHovered
          return (
            <Line
              key={m}
              type="monotone"
              dataKey={m}
              stroke={MINERAL_COLORS[m]}
              dot={false}
              strokeWidth={isHovered ? 3 : 1.5}
              strokeOpacity={isDimmed ? 0.2 : 1}
              isAnimationActive={false}
            />
          )
        })}
      </LineChart>
    </ResponsiveContainer>
  )
}

function LocationBreakdown({ mineral, byColony }: {
  mineral: string; byColony: { populationId: number; name: string; system: string; minerals: Record<string, number> }[]
}): React.JSX.Element {
  const sorted = byColony.map((c) => ({ ...c, amount: c.minerals[mineral] || 0 })).filter((c) => c.amount > 0).sort((a, b) => b.amount - a.amount)
  if (sorted.length === 0) return <div style={{ fontSize: 10, color: 'var(--cic-cyan-dim)' }}>No stockpiles</div>

  const max = sorted[0].amount
  const td: React.CSSProperties = { padding: '3px 6px', borderBottom: '1px solid var(--cic-panel-edge)', fontSize: 11 }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead><tr style={{ color: 'var(--cic-cyan)' }}>
        <th style={{ ...td, textAlign: 'left', fontSize: 9 }}>Colony</th>
        <th style={{ ...td, textAlign: 'right', fontSize: 9 }}>Stockpile</th>
        <th style={{ ...td, fontSize: 9, minWidth: 80 }}></th>
      </tr></thead>
      <tbody>
        {sorted.map((c) => (
          <tr key={c.populationId}>
            <td style={td}>{c.name}{c.system && <span style={{ color: 'var(--cic-cyan-dim)' }}> ({c.system})</span>}</td>
            <td style={{ ...td, textAlign: 'right' }}>{c.amount.toLocaleString()} L</td>
            <td style={td}>
              <div style={{ height: 6, background: 'var(--cic-panel-edge)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ width: `${(c.amount / max) * 100}%`, height: '100%', background: MINERAL_COLORS[mineral], borderRadius: 999 }} />
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function BreakdownChart({ data }: { data: MineralBreakdownResponse }): React.JSX.Element {
  if (data.series.length === 0) return <div style={{ fontSize: 10, color: 'var(--cic-cyan-dim)' }}>No data</div>

  const incomeKeys = new Set<string>()
  const expenseKeys = new Set<string>()
  for (const pt of data.series) {
    for (const k of Object.keys(pt.income)) incomeKeys.add(k)
    for (const k of Object.keys(pt.expense)) expenseKeys.add(k)
  }

  const chartData = data.series.map((pt) => {
    const row: Record<string, unknown> = { date: pt.gameDate, net: pt.net }
    for (const k of incomeKeys) row[k] = pt.income[k] || 0
    for (const k of expenseKeys) row[`-${k}`] = -(pt.expense[k] || 0)
    return row
  })

  const incomeColors = ['#3fb950', '#56d4dd', '#79c0ff', '#e3b341']
  const expenseColors = ['#f85149', '#f778ba', '#ffa657', '#bc8cff', '#d2a622', '#8b949e']
  const labelInterval = Math.max(1, Math.floor(chartData.length / 10))

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 20 }} stackOffset="sign">
        <CartesianGrid strokeDasharray="3 3" stroke="var(--cic-panel-edge)" />
        <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--cic-cyan-dim)' }} interval={labelInterval} />
        <YAxis tick={{ fontSize: 9, fill: 'var(--cic-cyan-dim)' }} tickFormatter={formatAmount} />
        <Tooltip
          contentStyle={{ background: 'var(--cic-panel)', border: '1px solid var(--cic-panel-edge)', fontSize: 10 }}
          formatter={(value: number, name: string) => [
            `${Math.abs(Number(value)).toLocaleString()} L`,
            String(name).startsWith('-') ? String(name).slice(1) : String(name)
          ]}
        />
        <Legend wrapperStyle={{ fontSize: 9 }} formatter={(v: string) => v.startsWith('-') ? v.slice(1) : v} />
        {[...incomeKeys].map((k, i) => (
          <Bar key={k} dataKey={k} stackId="stack" fill={incomeColors[i % incomeColors.length]} isAnimationActive={false} />
        ))}
        {[...expenseKeys].map((k, i) => (
          <Bar key={`-${k}`} dataKey={`-${k}`} stackId="stack" fill={expenseColors[i % expenseColors.length]} isAnimationActive={false} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

function formatAmount(n: number): string {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(1)}M`
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(0)}k`
  return `${sign}${abs}`
}

function PulseText({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <span style={{ animation: 'cic-pulse 2s ease-in-out infinite' }}>
      <style>{`@keyframes cic-pulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }`}</style>
      {children}
    </span>
  )
}
