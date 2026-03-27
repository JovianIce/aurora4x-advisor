import { useState, useMemo, useRef, useCallback } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getGroupedRowModel,
  getExpandedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type GroupingState,
  type ExpandedState,
  type ColumnFiltersState,
  type Row
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { Ship } from '@renderer/hooks/use-data'
import { FuelBar, ShipTag } from './ui'
import { FilterBar, applyGroupFilters, summarizeGroups, type FilterGroup } from './FilterBar'

const col = createColumnHelper<Ship>()

function DeployCell({ value, ship }: { value: number | null; ship: Ship }): React.JSX.Element {
  if (ship.fighter) return <span style={{ color: 'var(--cic-cyan-dim)' }}>Fighter</span>
  if (ship.commercial) return <span style={{ color: 'var(--cic-cyan-dim)' }}>—</span>
  if (value == null) return <span style={{ color: 'var(--cic-cyan-dim)' }}>—</span>
  if (value < 0)
    return (
      <span style={{ color: 'var(--cic-red)', fontWeight: 500 }}>{Math.abs(value)}mo OVER</span>
    )
  if (value < 6) return <span style={{ color: 'var(--cic-amber)' }}>{value}mo</span>
  return <span>{value}mo</span>
}

function OverhaulCell({ value, ship }: { value: number; ship: Ship }): React.JSX.Element {
  if (ship.fighter) return <span style={{ color: 'var(--cic-cyan-dim)' }}>Fighter</span>
  if (ship.commercial) return <span style={{ color: 'var(--cic-cyan-dim)' }}>—</span>
  if (value > 40) return <span style={{ color: 'var(--cic-red)', fontWeight: 500 }}>{value}mo</span>
  if (value > 30) return <span style={{ color: 'var(--cic-amber)' }}>{value}mo</span>
  return <span>{value}mo</span>
}

function MaintCell({ value }: { value: number }): React.JSX.Element {
  if (value > 0) return <span style={{ color: 'var(--cic-red)', fontWeight: 500 }}>MS{value}</span>
  return <span style={{ color: 'var(--cic-cyan-dim)' }}>OK</span>
}

const columns = [
  col.accessor('name', {
    header: 'Ship',
    cell: (info) => <span className="font-medium">{info.getValue()}</span>,
    size: 160
  }),
  col.accessor('className', {
    header: 'Class',
    cell: (info) => (
      <span>
        {info.getValue()}
        <ShipTag ship={info.row.original} />
      </span>
    ),
    size: 140
  }),
  col.accessor('fleet', { header: 'Fleet', size: 180 }),
  col.accessor('system', {
    header: 'System',
    cell: (info) =>
      info.getValue() === 'Transit' ? (
        <span style={{ color: 'var(--cic-amber)' }}>Transit</span>
      ) : (
        info.getValue()
      ),
    size: 130
  }),
  col.accessor('speed', {
    header: 'Speed',
    cell: (info) => `${info.getValue()} km/s`,
    size: 90
  }),
  col.accessor('fuelPct', {
    header: 'Fuel',
    cell: (info) => <FuelBar pct={info.getValue()} />,
    size: 120,
    sortDescFirst: true
  }),
  col.accessor('rangeDays', {
    header: 'Range',
    cell: (info) => {
      const v = info.getValue()
      return v ? `${v}d` : <span style={{ color: 'var(--cic-cyan-dim)' }}>—</span>
    },
    size: 70
  }),
  col.accessor('deploymentRemaining', {
    header: 'Deploy',
    cell: (info) => <DeployCell value={info.getValue()} ship={info.row.original} />,
    size: 80
  }),
  col.accessor('monthsSinceOverhaul', {
    header: 'Overhaul',
    cell: (info) => <OverhaulCell value={info.getValue()} ship={info.row.original} />,
    size: 80
  }),
  col.accessor('maintenanceState', {
    header: 'Maint',
    cell: (info) => <MaintCell value={info.getValue()} />,
    size: 60
  })
]

interface FleetTableProps {
  ships: Ship[]
  onSelectShip: (ship: Ship) => void
  selectedShipId: number | null
}

const STORAGE_KEY = 'aurora-ops-fleet-table'

function loadSettings(): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveSettings(settings: Record<string, unknown>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

export function FleetTable({
  ships,
  onSelectShip,
  selectedShipId
}: FleetTableProps): React.JSX.Element {
  const saved = loadSettings()
  const [sorting, setSorting] = useState<SortingState>((saved?.sorting as SortingState) || [])
  const [grouping, setGrouping] = useState<GroupingState>(
    (saved?.grouping as GroupingState) || ['fleet']
  )
  const [expanded, setExpanded] = useState<ExpandedState>(true)
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [filterMode, setFilterMode] = useState<'all' | 'military' | 'commercial'>(
    (saved?.filterMode as 'all' | 'military' | 'commercial') || 'all'
  )
  const [filterGroups, setFilterGroups] = useState<FilterGroup[]>(
    (saved?.filterGroups as FilterGroup[]) || []
  )

  const persist = (patch: Record<string, unknown>): void => {
    saveSettings({ sorting, grouping, filterMode, filterGroups, ...patch })
  }

  const persistFilterGroups = (fg: FilterGroup[]): void => {
    setFilterGroups(fg)
    persist({ filterGroups: fg })
  }

  const filteredShips = useMemo(() => {
    let result = ships
    if (filterMode === 'military') result = result.filter((s) => s.military || s.fighter)
    else if (filterMode === 'commercial') result = result.filter((s) => s.commercial && !s.fighter)
    result = applyGroupFilters(result as unknown as Record<string, unknown>[], filterGroups) as unknown as Ship[]
    return result
  }, [ships, filterMode, filterGroups])

  const table = useReactTable({
    data: filteredShips,
    columns,
    state: { sorting, grouping, expanded, columnFilters, globalFilter },
    onSortingChange: (s) => {
      const val = typeof s === 'function' ? s(sorting) : s
      setSorting(val)
      persist({ sorting: val })
    },
    onGroupingChange: (g) => {
      const val = typeof g === 'function' ? g(grouping) : g
      setGrouping(val)
      persist({ grouping: val })
    },
    onExpandedChange: setExpanded,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowCanExpand: () => true
  })

  const { rows } = table.getRowModel()
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback((index: number) => (rows[index]?.getIsGrouped() ? 18 : 16), [rows]),
    overscan: 20
  })

  const groupByOptions = [
    { value: 'fleet', label: 'Fleet' },
    { value: 'system', label: 'System' },
    { value: 'className', label: 'Class' }
  ]

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

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div
        className="flex items-center gap-1.5 px-2 py-1 shrink-0 flex-nowrap overflow-hidden"
        style={{ borderBottom: '1px solid var(--cic-panel-edge)' }}
      >
        <input
          type="text"
          placeholder="Search ships..."
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="text-[10px] border rounded px-1.5 py-1 w-40 focus:outline-none"
          style={{
            background: 'var(--cic-panel)',
            borderColor: 'var(--cic-panel-edge)',
            color: 'var(--cic-cyan)'
          }}
        />

        <div className="flex items-center gap-1 ml-2">
          <span
            style={{
              fontSize: 9,
              color: 'var(--cic-cyan-dim)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}
          >
            Group:
          </span>
          {groupByOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                const val = grouping[0] === opt.value ? [] : [opt.value]
                setGrouping(val)
                persist({ grouping: val })
              }}
              className="cursor-pointer"
              style={{
                padding: '2px 6px',
                fontSize: 10,
                borderRadius: 3,
                background: grouping[0] === opt.value ? 'var(--cic-cyan)' : 'transparent',
                color: grouping[0] === opt.value ? 'var(--cic-deep)' : 'var(--cic-cyan-dim)',
                fontWeight: grouping[0] === opt.value ? 600 : 400,
                border: 'none'
              }}
            >
              {opt.label}
            </button>
          ))}
          <button
            onClick={() => {
              setGrouping([])
              persist({ grouping: [] })
            }}
            className="cursor-pointer"
            style={{
              padding: '2px 6px',
              fontSize: 10,
              borderRadius: 3,
              background: grouping.length === 0 ? 'var(--cic-cyan)' : 'transparent',
              color: grouping.length === 0 ? 'var(--cic-deep)' : 'var(--cic-cyan-dim)',
              fontWeight: grouping.length === 0 ? 600 : 400,
              border: 'none'
            }}
          >
            None
          </button>
        </div>

        <button
          onClick={() => setExpanded(expanded === true ? {} : true)}
          className="cursor-pointer"
          style={{
            padding: '2px 6px',
            fontSize: 10,
            borderRadius: 3,
            color: 'var(--cic-cyan-dim)',
            background: 'transparent',
            border: 'none'
          }}
        >
          {expanded === true ? '▼' : '▶'}
        </button>

        <div className="flex-1" />

        <div className="flex items-center gap-1">
          {(
            [
              ['all', 'All'],
              ['military', 'MIL'],
              ['commercial', 'COMM']
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              onClick={() => {
                setFilterMode(mode)
                persist({ filterMode: mode })
              }}
              className="cursor-pointer"
              style={{
                padding: '2px 6px',
                fontSize: 9,
                borderRadius: 3,
                background: filterMode === mode ? 'var(--cic-cyan)' : 'transparent',
                color: filterMode === mode ? 'var(--cic-deep)' : 'var(--cic-cyan-dim)',
                fontWeight: filterMode === mode ? 600 : 400,
                border: 'none'
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <span
          style={{
            fontSize: 10,
            color: 'var(--cic-cyan-dim)',
            marginLeft: 4,
            whiteSpace: 'nowrap'
          }}
        >
          {filteredShips.length} ship{filteredShips.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Filter bar */}
      <div style={{ padding: '4px 8px', borderBottom: '1px solid var(--cic-panel-edge)' }}>
        <FilterBar groups={filterGroups} onChange={persistFilterGroups} />
      </div>

      {/* Active filter summary */}
      {filterGroups.length > 0 &&
        (() => {
          const summary = summarizeGroups(filterGroups)
          return summary ? (
            <div
              style={{
                padding: '2px 8px',
                borderBottom: '1px solid var(--cic-panel-edge)',
                fontSize: 8,
                color: 'var(--cic-cyan-dim)',
                lineHeight: 1.4,
                maxHeight: 28,
                overflow: 'hidden',
                fontFamily: 'monospace'
              }}
            >
              {summary}
            </div>
          ) : null
        })()}

      {/* Table */}
      <div ref={parentRef} className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10" style={{ background: 'var(--cic-deep)' }}>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    onClick={
                      header.column.getCanSort()
                        ? header.column.getToggleSortingHandler()
                        : undefined
                    }
                    className={
                      header.column.getCanSort() ? 'cursor-pointer select-none' : 'select-none'
                    }
                    style={{ ...thStyle, width: header.getSize() }}
                  >
                    <div className="flex items-center gap-1">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === 'asc' && (
                        <span style={{ color: 'var(--cic-cyan)' }}>↑</span>
                      )}
                      {header.column.getIsSorted() === 'desc' && (
                        <span style={{ color: 'var(--cic-cyan)' }}>↓</span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index] as Row<Ship>
              const isSelected = !row.getIsGrouped() && row.original.shipId === selectedShipId

              if (row.getIsGrouped()) {
                const ships = row.subRows.map((r) => r.original)
                const groupValue = String(row.getGroupingValue(grouping[0] || 'fleet') ?? '—')
                const composition = summarizeComposition(ships)
                const avgFuel = avgFuelPct(ships)
                const system = grouping[0] !== 'system' ? ships[0]?.system : null

                return (
                  <tr
                    key={row.id}
                    onClick={() => row.toggleExpanded()}
                    className="cursor-pointer"
                    style={{ background: 'rgba(0,229,255,0.03)' }}
                  >
                    {row.getVisibleCells().map((cell, i) => (
                      <td key={cell.id} style={{ ...tdStyle, width: cell.column.getSize() }}>
                        {i === 0 && (
                          <span className="flex items-center gap-1">
                            <span style={{ fontSize: 8, color: 'var(--cic-cyan-dim)' }}>
                              {row.getIsExpanded() ? '▼' : '▶'}
                            </span>
                            <span style={{ fontSize: 9, fontWeight: 600 }}>{groupValue}</span>
                          </span>
                        )}
                        {i === 1 && (
                          <span
                            style={{ fontSize: 8, color: 'var(--cic-cyan-dim)', opacity: 0.7 }}
                            className="truncate block"
                          >
                            {composition}
                          </span>
                        )}
                        {cell.column.id === 'system' && system && (
                          <span
                            style={{
                              fontSize: 8,
                              color:
                                system === 'Transit' ? 'var(--cic-amber)' : 'var(--cic-cyan-dim)',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {system}
                          </span>
                        )}
                        {cell.column.id === 'fuelPct' && <FuelBar pct={avgFuel} />}
                        {cell.column.id === 'deploymentRemaining' && (
                          <span
                            style={{
                              fontSize: 8,
                              color: 'var(--cic-cyan-dim)',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {ships.length} ship{ships.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                )
              }

              return (
                <tr
                  key={row.id}
                  onClick={() => onSelectShip(row.original)}
                  className="cursor-pointer transition-colors"
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
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} style={{ ...tdStyle, width: cell.column.getSize() }}>
                      {cell.getIsAggregated()
                        ? null
                        : flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function summarizeComposition(ships: Ship[]): string {
  const counts = new Map<string, number>()
  for (const s of ships) counts.set(s.className, (counts.get(s.className) || 0) + 1)
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => (count > 1 ? `${count}× ${name}` : name))
    .join(', ')
}

function avgFuelPct(ships: Ship[]): number | null {
  const fuels = ships.filter((s) => s.fuelPct != null).map((s) => s.fuelPct!)
  return fuels.length ? Math.round(fuels.reduce((a, b) => a + b, 0) / fuels.length) : null
}
