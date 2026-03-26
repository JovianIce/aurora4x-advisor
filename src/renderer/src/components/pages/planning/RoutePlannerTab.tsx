import React, { useState } from 'react'
import {
  useWaypoints,
  useClasses,
  useFleets,
  useGameDate,
  useComputeRoute,
  useComputeFleetRoute,
  type RouteResult,
  type FleetRouteResult,
  type FleetRouteLeg,
  type GameDate
} from '@renderer/hooks/use-ops'
import { InfoCard, SectionHeader, DualFuelBar, Tooltip } from './ui'
import { SearchPicker, type PickerItem } from './SearchPicker'
import { SaveRouteButton, SavedRoutesPanel, type SavedRoute } from './SavedRoutes'

type Mode = 'fleet' | 'class'

export interface RoutePlannerProps {
  initialFleetId?: number
  initialClassId?: number
  initialFromSystem?: number
}

const ROUTE_STORAGE_KEY = 'aurora-planning-route'

function loadRouteState(): Record<string, unknown> {
  try { return JSON.parse(localStorage.getItem(ROUTE_STORAGE_KEY) || '{}') }
  catch { return {} }
}

function saveRouteState(patch: Record<string, unknown>): void {
  const prev = loadRouteState()
  localStorage.setItem(ROUTE_STORAGE_KEY, JSON.stringify({ ...prev, ...patch }))
}

export function RoutePlannerTab({ active = true, initialFleetId, initialClassId, initialFromSystem }: RoutePlannerProps & { active?: boolean } = {}): React.JSX.Element {
  const { data: wpData } = useWaypoints(active)
  const { data: classData } = useClasses(active)
  const { data: fleetData } = useFleets(active)
  const { data: dateData } = useGameDate(active)
  const computeRouteMut = useComputeRoute()
  const computeFleetRouteMut = useComputeFleetRoute()

  const saved = loadRouteState()
  // Props override saved state (for "Plan Route" from fleet tab)
  const [mode, setModeRaw] = useState<Mode>(initialFleetId ? 'fleet' : initialClassId ? 'class' : (saved.mode as Mode) || 'fleet')
  const [classId, setClassIdRaw] = useState<number>(initialClassId || (saved.classId as number) || 0)
  const [fleetId, setFleetIdRaw] = useState<number>(initialFleetId || (saved.fleetId as number) || 0)
  const [startSystemId, setStartSystemIdRaw] = useState<number>(initialFromSystem || (saved.startSystemId as number) || 0)
  const [endSystemId, setEndSystemIdRaw] = useState<number>((saved.endSystemId as number) || 21625)

  const setMode = (v: Mode): void => { setModeRaw(v); saveRouteState({ mode: v }) }
  const setClassId = (v: number): void => { setClassIdRaw(v); saveRouteState({ classId: v }) }
  const setFleetId = (v: number): void => { setFleetIdRaw(v); saveRouteState({ fleetId: v }) }
  const setStartSystemId = (v: number): void => { setStartSystemIdRaw(v); saveRouteState({ startSystemId: v }) }
  const setEndSystemId = (v: number): void => { setEndSystemIdRaw(v); saveRouteState({ endSystemId: v }) }
  const [intermediates, setIntermediates] = useState<number[]>([])
  const [fleetWaypoints, setFleetWaypoints] = useState<{ systemId: number; refuel: boolean }[]>([])
  const [savedRoutesKey, setSavedRoutesKey] = useState(0)

  const dataLoading = !wpData && !classData && !fleetData
  const waypoints = wpData || []
  const classes = classData || []
  const fleets = fleetData || []

  const systems = waypoints.filter((w) => w.label.includes('(system)'))
  const colonies = waypoints.filter((w) => !w.label.includes('(system)'))

  const selectedFleet = fleets.find((f) => f.fleetId === fleetId)

  const sysName = (id: number): string => {
    const s = systems.find((w) => w.systemId === id)
    return s?.systemName || `System ${id}`
  }

  const handleLoadRoute = (route: SavedRoute): void => {
    // Keep current mode unless route has a class assigned (then use class mode)
    if (route.classId) setMode('class')
    // In class mode, use saved start system. In fleet mode, start comes from fleet position.
    if (mode === 'class' || route.classId) {
      setStartSystemId(route.startSystemId)
    }
    setEndSystemId(route.endSystemId)
    const wps = route.waypoints.map((w) => w.systemId)
    setIntermediates(wps)
    setFleetWaypoints(route.waypoints.map((w) => ({ systemId: w.systemId, refuel: !!w.refuel })))
    if (route.classId) {
      setClassId(route.classId)
      // Auto-compute with the loaded values directly (state hasn't flushed yet)
      computeRouteMut.mutate({
        classId: route.classId,
        startSystemId: route.startSystemId,
        endSystemId: route.endSystemId,
        waypointSystemIds: wps.filter(Boolean)
      })
    }
  }

  const isLoading = mode === 'fleet' ? computeFleetRouteMut.isPending : computeRouteMut.isPending
  const error = mode === 'fleet' ? computeFleetRouteMut.error : computeRouteMut.error
  const classResult = computeRouteMut.data
  const fleetResult = computeFleetRouteMut.data

  const handleCompute = (): void => {
    if (mode === 'class') {
      if (!classId || !startSystemId || !endSystemId) return
      computeRouteMut.mutate({
        classId,
        startSystemId,
        endSystemId,
        waypointSystemIds: intermediates.filter(Boolean)
      })
    } else {
      if (!fleetId || !endSystemId) return
      computeFleetRouteMut.mutate({
        fleetId,
        endSystemId,
        waypoints: fleetWaypoints
          .filter((w) => w.systemId > 0)
          .map((w) => ({ systemId: w.systemId, refuel: w.refuel || undefined }))
      })
    }
  }

  const canCompute =
    mode === 'class' ? classId > 0 && startSystemId > 0 && endSystemId > 0 : fleetId > 0 && endSystemId > 0

  const ss: React.CSSProperties = {
    fontSize: 11,
    padding: '4px 8px',
    background: 'var(--cic-panel)',
    border: '1px solid var(--cic-panel-edge)',
    borderRadius: 4,
    color: 'var(--foreground)',
    width: '100%'
  }

  if (dataLoading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: 'var(--cic-cyan-dim)', fontSize: 11 }}>
        Loading route data...
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Left - Config */}
      <div style={{ width: 320, minWidth: 320, borderRight: '1px solid var(--cic-panel-edge)', overflow: 'auto', padding: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--cic-cyan)', marginBottom: 12 }}>Route Planner</div>

        <SectionHeader>Mode</SectionHeader>
        <div className="flex" style={{ gap: 1, marginBottom: 6 }}>
          {(['fleet', 'class'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="cursor-pointer"
              style={{
                flex: 1,
                padding: '4px 8px',
                fontSize: 10,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                border: '1px solid var(--cic-panel-edge)',
                borderRadius: m === 'fleet' ? '4px 0 0 4px' : '0 4px 4px 0',
                background: mode === m ? 'var(--cic-cyan)' : 'var(--cic-panel)',
                color: mode === m ? 'var(--cic-deep)' : 'var(--cic-cyan-dim)'
              }}
            >
              {m}
            </button>
          ))}
        </div>

        {mode === 'fleet' ? (
          <>
            <SectionHeader>Fleet</SectionHeader>
            <select value={fleetId} onChange={(e) => setFleetId(Number(e.target.value))} style={ss}>
              <option value={0}>Select fleet...</option>
              {fleets.map((f) => (
                <option key={f.fleetId} value={f.fleetId}>
                  {f.fleetName} - {f.ships.length} ships ({f.systemName})
                </option>
              ))}
            </select>
            {selectedFleet && (() => {
              const ja = selectedFleet.jumpAnalysis
              return (
              <div style={{ marginTop: 4, background: 'var(--cic-panel)', border: '1px solid var(--cic-panel-edge)', borderRadius: 4, fontSize: 10, color: 'var(--cic-cyan-dim)' }}>
                {/* Jump notice - always at top */}
                {ja.status === 'covered' && (
                  <div style={{ padding: '3px 8px', background: 'rgba(255,179,0,0.08)', borderBottom: '1px solid var(--cic-panel-edge)', borderRadius: '4px 4px 0 0', fontSize: 9, color: 'var(--cic-amber)' }}>
                    {ja.shipsWithoutJD.length} ship{ja.shipsWithoutJD.length !== 1 ? 's' : ''} without jump drive
                    {ja.milTender && <> | has mil squad jump: {ja.milTender.shipName} ({ja.milTender.maxTonnage.toLocaleString()}t)</>}
                    {ja.commTender && <> | has comm squad jump: {ja.commTender.shipName} ({ja.commTender.maxTonnage.toLocaleString()}t)</>}
                  </div>
                )}
                {ja.status === 'warning' && (
                  <div style={{ padding: '3px 8px', background: 'rgba(255,23,68,0.08)', borderBottom: '1px solid var(--cic-panel-edge)', borderRadius: '4px 4px 0 0', fontSize: 9, color: 'var(--cic-red)' }}>
                    ⚠ {ja.uncoveredShips.length} ship{ja.uncoveredShips.length !== 1 ? 's' : ''} cannot jump:
                    {ja.uncoveredShips.map((s, i) => <span key={i}> {s.shipName} ({s.reason}){i < ja.uncoveredShips.length - 1 ? ',' : ''}</span>)}
                  </div>
                )}
                {ja.squadCapWarning && (
                  <div style={{ padding: '3px 8px', background: 'rgba(255,23,68,0.08)', borderBottom: '1px solid var(--cic-panel-edge)', fontSize: 9, color: 'var(--cic-red)' }}>
                    ⚠ {ja.squadCapWarning}
                  </div>
                )}
                {/* Ship list - scrollable */}
                <div style={{ maxHeight: 200, overflow: 'auto', padding: '4px 8px' }}>
                  {selectedFleet.ships.map((s) => {
                    const rate = Math.round(s.enginePower * s.fuelEfficiency * 100) / 100
                    const tons = s.tonnage >= 1000 ? `${(s.tonnage / 1000).toFixed(1)}kt` : `${s.tonnage}t`
                    const jdTip = s.jumpDriveInfo
                      ? `${s.jumpDriveInfo.type}, ${s.jumpDriveInfo.maxTonnage.toLocaleString()}t max` +
                        (s.jumpDriveInfo.squadMax > 0 ? `, squad ${s.jumpDriveInfo.squadMax}` : '') +
                        (s.jumpDriveInfo.radius > 0 ? `, radius ${s.jumpDriveInfo.radius}` : '')
                      : 'No jump drive'
                    return (
                      <Tooltip key={s.shipId} text={jdTip}>
                        <div className="flex justify-between items-center" style={{ padding: '1px 0' }}>
                          <span className="truncate" style={{ minWidth: 0 }}>
                            {!s.jumpCapable && <span style={{ color: ja.status === 'covered' ? 'var(--cic-amber)' : 'var(--cic-red)', fontWeight: 600, marginRight: 3 }}>⚠</span>}
                            {s.shipName} <span className="truncate" style={{ color: 'var(--cic-cyan-dim)', maxWidth: 80, display: 'inline-block', verticalAlign: 'bottom', overflow: 'hidden', textOverflow: 'ellipsis' }}>({s.className})</span>
                          </span>
                          <span style={{ color: 'var(--cic-cyan-dim)', whiteSpace: 'nowrap', marginLeft: 8, fontSize: 9 }}>{tons} · {s.maxSpeed} kms · {rate} L/hr</span>
                        </div>
                      </Tooltip>
                    )
                  })}
                </div>
              </div>
              )
            })()}
          </>
        ) : (
          <>
            <SectionHeader>Ship Class</SectionHeader>
            <select value={classId} onChange={(e) => setClassId(Number(e.target.value))} style={ss}>
              <option value={0}>Select class...</option>
              {classes.map((c) => (
                <option key={c.ShipClassID} value={c.ShipClassID}>
                  {c.ClassName} - {c.MaxSpeed} kms, {c.FuelCapacity.toLocaleString()} L
                </option>
              ))}
            </select>
            {classId > 0 && (() => {
              const cls = classes.find((c) => c.ShipClassID === classId)
              return cls && cls.JumpDistance === 0 ? (
                <div style={{ marginTop: 3, padding: '2px 6px', background: 'rgba(255,23,68,0.08)', border: '1px solid var(--cic-red)', borderRadius: 3, fontSize: 9, color: 'var(--cic-red)' }}>
                  ⚠ No jump drive, needs squad jump or jump gate
                </div>
              ) : null
            })()}
            <SectionHeader>From</SectionHeader>
            <SystemPicker value={startSystemId} onChange={setStartSystemId} systems={systems} colonies={colonies} title="Origin" placeholder="Select origin..." />
          </>
        )}

        <SectionHeader>To</SectionHeader>
        <SystemPicker value={endSystemId} onChange={setEndSystemId} systems={systems} colonies={colonies} title="Destination" placeholder="Select destination..." />

        <SectionHeader>Waypoints (optional)</SectionHeader>
        <div style={{ maxHeight: 150, overflow: 'auto' }}>
          {mode === 'class' ? (
            <>
              {intermediates.map((wp, i) => (
                <div key={i} className="flex gap-1" style={{ marginBottom: 2 }}>
                  <select value={wp} onChange={(e) => { const next = [...intermediates]; next[i] = Number(e.target.value); setIntermediates(next) }} style={{ ...ss, flex: 1 }}>
                    <option value={0}>Select...</option>
                    {systems.map((w) => <option key={w.systemId} value={w.systemId}>{w.systemName}</option>)}
                  </select>
                  <button onClick={() => setIntermediates(intermediates.filter((_, j) => j !== i))} className="cursor-pointer" style={{ border: 'none', background: 'transparent', color: 'var(--cic-cyan-dim)', fontSize: 12 }}>×</button>
                </div>
              ))}
            </>
          ) : (
            <>
              {fleetWaypoints.map((wp, i) => (
                <div key={i} className="flex gap-1 items-center" style={{ marginBottom: 2 }}>
                  <select value={wp.systemId} onChange={(e) => { const next = [...fleetWaypoints]; next[i] = { ...next[i], systemId: Number(e.target.value) }; setFleetWaypoints(next) }} style={{ ...ss, flex: 1 }}>
                    <option value={0}>Select...</option>
                    {systems.map((w) => <option key={w.systemId} value={w.systemId}>{w.systemName}</option>)}
                  </select>
                  <label className="flex items-center gap-1 cursor-pointer" style={{ fontSize: 9, color: 'var(--cic-cyan-dim)', whiteSpace: 'nowrap' }}>
                    <input type="checkbox" checked={wp.refuel} onChange={(e) => { const next = [...fleetWaypoints]; next[i] = { ...next[i], refuel: e.target.checked }; setFleetWaypoints(next) }} />
                    Refuel
                  </label>
                  <button onClick={() => setFleetWaypoints(fleetWaypoints.filter((_, j) => j !== i))} className="cursor-pointer" style={{ border: 'none', background: 'transparent', color: 'var(--cic-cyan-dim)', fontSize: 12 }}>×</button>
                </div>
              ))}
            </>
          )}
        </div>
        <button onClick={() => mode === 'class' ? setIntermediates([...intermediates, 0]) : setFleetWaypoints([...fleetWaypoints, { systemId: 0, refuel: false }])} className="cursor-pointer" style={{ fontSize: 10, border: 'none', background: 'transparent', color: 'var(--cic-cyan)', padding: '2px 0' }}>+ Add waypoint</button>

        <div style={{ marginTop: 12 }}>
          <button
            onClick={handleCompute}
            disabled={!canCompute || isLoading}
            className="cursor-pointer"
            style={{
              width: '100%',
              fontSize: 12,
              padding: 8,
              borderRadius: 4,
              border: '1px solid var(--cic-cyan)',
              background: 'var(--cic-cyan)',
              color: 'var(--cic-deep)',
              fontWeight: 600,
              opacity: !canCompute ? 0.4 : 1
            }}
          >
            {isLoading ? 'Computing...' : 'Compute Route'}
          </button>

          <SaveRouteButton
            startSystemId={startSystemId}
            startSystemName={sysName(startSystemId)}
            endSystemId={endSystemId}
            endSystemName={sysName(endSystemId)}
            waypoints={intermediates.filter(Boolean).map((id) => ({ systemId: id, systemName: sysName(id) }))}
            classId={classId || undefined}
            className={classes.find((c) => c.ShipClassID === classId)?.ClassName}
            disabled={!startSystemId || !endSystemId}
            onSaved={() => setSavedRoutesKey((k) => k + 1)}
          />

          <SavedRoutesPanel
            onLoad={handleLoadRoute}
            classes={classes}
            refreshKey={savedRoutesKey}
          />
        </div>
      </div>

      {/* Right - Results */}
      <div className="flex-1 overflow-auto" style={{ padding: 12 }}>
        {error && (
          <div style={{ color: 'var(--cic-red)', fontSize: 11 }}>
            Error: {(error as Error).message || 'Failed to compute route'}
          </div>
        )}

        {mode === 'class' && classResult && <ClassRouteView result={classResult} gameDate={dateData ?? null} />}
        {mode === 'fleet' && fleetResult && <FleetRouteView result={fleetResult} gameDate={dateData ?? null} />}

        {!classResult && !fleetResult && !error && (
          <div className="flex items-center justify-center h-full" style={{ color: 'var(--cic-cyan-dim)', fontSize: 11 }}>
            {mode === 'fleet' ? 'Select a fleet and destination, then compute.' : 'Select a class and waypoints, then compute.'}
          </div>
        )}
      </div>
    </div>
  )
}

function SystemPicker({ value, onChange, systems, colonies, title, placeholder }: {
  value: number; onChange: (v: number) => void
  systems: { systemId: number; systemName: string }[]
  colonies: { systemId: number; label: string }[]
  title: string; placeholder: string
}): React.JSX.Element {
  const items: PickerItem[] = [
    ...systems.map((w): PickerItem => ({
      id: w.systemId,
      label: w.systemName,
      group: 'Systems'
    })),
    ...colonies.map((w, i): PickerItem => ({
      id: `col-${i}-${w.systemId}`,
      label: w.label,
      group: 'Colonies'
    }))
  ]

  return (
    <SearchPicker
      title={title}
      placeholder={placeholder}
      value={value || null}
      onSelect={(id) => {
        // Colony IDs are prefixed - extract the systemId
        if (typeof id === 'string' && id.startsWith('col-')) {
          const parts = id.split('-')
          onChange(Number(parts[parts.length - 1]))
        } else {
          onChange(Number(id))
        }
      }}
      items={items}
    />
  )
}

function ClassRouteView({ result, gameDate }: { result: RouteResult; gameDate: GameDate | null }): React.JSX.Element {
  const arrivalDate = gameDate ? addDaysToDate(gameDate, result.totalTravelDays) : null

  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--cic-cyan)', marginBottom: 6 }}>
        {result.className}: Route Summary
      </div>
      <div className="grid grid-cols-4 gap-2" style={{ marginBottom: 12 }}>
        <InfoCard label="Travel Time" value={`${result.totalTravelDays} days`} sub={arrivalDate ? `Arrives ${arrivalDate}` : undefined} />
        <InfoCard label="Distance" value={formatDistance(result.totalDistanceKm)} />
        <InfoCard label="Fuel Burn" value={`${result.totalFuelBurn.toLocaleString()} L`} sub={`of ${result.fuelCapacity.toLocaleString()} L capacity`} warn={!result.sufficient} crit={!result.sufficient} />
        <InfoCard label="Fuel Remaining" value={`${result.fuelRemaining.toLocaleString()} L`} sub={result.sufficient ? `${Math.round(result.fuelRemaining / result.fuelCapacity * 100)}% remaining` : 'INSUFFICIENT'} crit={!result.sufficient} warn={result.fuelRemaining < result.fuelCapacity * 0.25} />
      </div>

      <SectionHeader>Route Legs</SectionHeader>
      <LegTable legs={result.legs.map((l) => ({ ...l, fuelBurn: l.fuelBurn }))} gameDate={gameDate} />

      <div style={{ marginTop: 12, fontSize: 10, color: 'var(--cic-cyan-dim)' }}>
        Speed: {result.speed} kms. Estimates use straight-line distances between jump points.
      </div>
    </div>
  )
}

function FleetRouteView({ result, gameDate }: { result: FleetRouteResult; gameDate: GameDate | null }): React.JSX.Element {
  const arrivalDate = gameDate ? addDaysToDate(gameDate, result.totalTravelDays) : null

  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--cic-cyan)', marginBottom: 6 }}>
        {result.fleetName}: Fleet Route
      </div>
      <div className="grid grid-cols-4 gap-2" style={{ marginBottom: 12 }}>
        <InfoCard label="Travel Time" value={`${result.totalTravelDays} days`} sub={arrivalDate ? `Arrives ${arrivalDate}` : undefined} />
        <InfoCard label="Distance" value={formatDistance(result.totalDistanceKm)} />
        <InfoCard label="Fleet Speed" value={`${result.fleetSpeed} km/s`} sub={`Limited by ${result.speedLimitedBy}`} />
        <InfoCard label="Bottleneck" value={result.bottleneck ? result.bottleneck.name : 'None'} sub={result.bottleneck ? `Short ${result.bottleneck.shortfall.toLocaleString()} L on leg ${result.bottleneck.runsOutOnLeg + 1}` : 'All ships sufficient'} crit={!!result.bottleneck} />
      </div>

      {result.tankerInFleet && (
        <div style={{ marginBottom: 12, padding: '4px 8px', background: 'rgba(255,179,0,0.1)', border: '1px solid var(--cic-amber)', borderRadius: 4, fontSize: 10 }}>
          <span style={{ color: 'var(--cic-amber)', fontWeight: 600 }}>Tanker: </span>
          {result.tankerInFleet.name}: {result.tankerInFleet.fuelRemaining.toLocaleString()} L at destination
          (of {result.tankerInFleet.fuelCapacity.toLocaleString()} L capacity)
        </div>
      )}

      <SectionHeader>Route Legs</SectionHeader>
      <FleetLegTable legs={result.legs} gameDate={gameDate} />

      <SectionHeader>Ship Fuel Status (End of Route)</SectionHeader>
      <ShipFuelTable legs={result.legs} bottleneckId={result.bottleneck?.shipId ?? null} />

      <div style={{ marginTop: 12, fontSize: 10, color: 'var(--cic-cyan-dim)' }}>
        Speed: {result.fleetSpeed} kms (fleet minimum). Estimates use straight-line distances.
      </div>
    </div>
  )
}

function LegTable({ legs, gameDate }: {
  legs: { from: { systemName: string }; to: { systemName: string }; type: string; distanceKm: number; travelDays: number; fuelBurn: number }[]
  gameDate: GameDate | null
}): React.JSX.Element {
  const th: React.CSSProperties = { textAlign: 'left', padding: '3px 6px', borderBottom: '1px solid var(--cic-panel-edge)', fontSize: 9, color: 'var(--cic-cyan)' }
  const thR: React.CSSProperties = { ...th, textAlign: 'right' }
  const td: React.CSSProperties = { padding: '3px 6px', borderBottom: '1px solid var(--cic-panel-edge)', fontSize: 11 }
  const tdR: React.CSSProperties = { ...td, textAlign: 'right' }

  const totals = legs.reduce((a, l) => ({ dist: a.dist + l.distanceKm, days: a.days + l.travelDays, fuel: a.fuel + l.fuelBurn }), { dist: 0, days: 0, fuel: 0 })
  let cumDays = 0

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead><tr>
        <th style={th}>From</th><th style={th}>To</th><th style={th}>Type</th>
        <th style={thR}>Distance</th><th style={thR}>Time</th><th style={thR}>Fuel</th>
        {gameDate && <th style={thR}>Arrival</th>}
      </tr></thead>
      <tbody>
        {legs.map((leg, i) => {
          cumDays += leg.travelDays
          const arrival = gameDate && leg.type !== 'jump' ? addDaysToDate(gameDate, cumDays) : null
          return (
            <tr key={i} style={{ opacity: leg.type === 'jump' ? 0.6 : 1 }}>
              <td style={td}>{leg.from.systemName}</td>
              <td style={td}>{leg.to.systemName}</td>
              <td style={td}>{leg.type === 'jump' ? <span style={{ color: '#bc8cff', fontWeight: 600 }}>JUMP</span> : <span style={{ color: 'var(--cic-cyan-dim)' }}>transit</span>}</td>
              <td style={tdR}>{leg.type === 'jump' ? '—' : formatDistance(leg.distanceKm)}</td>
              <td style={tdR}>{leg.type === 'jump' ? '—' : `${leg.travelDays}d`}</td>
              <td style={tdR}>{leg.type === 'jump' ? '—' : `${leg.fuelBurn.toLocaleString()} L`}</td>
              {gameDate && <td style={{ ...tdR, color: 'var(--cic-cyan-dim)' }}>{leg.type === 'jump' ? '—' : arrival}</td>}
            </tr>
          )
        })}
      </tbody>
      <tfoot>
        <tr style={{ fontWeight: 600 }}>
          <td colSpan={3} style={{ padding: '3px 6px', borderTop: '2px solid var(--cic-panel-edge)' }}>Total</td>
          <td style={{ ...tdR, borderTop: '2px solid var(--cic-panel-edge)' }}>{formatDistance(Math.round(totals.dist))}</td>
          <td style={{ ...tdR, borderTop: '2px solid var(--cic-panel-edge)' }}>{Math.round(totals.days * 100) / 100}d</td>
          <td style={{ ...tdR, borderTop: '2px solid var(--cic-panel-edge)' }}>{Math.round(totals.fuel).toLocaleString()} L</td>
          {gameDate && <td style={{ ...tdR, borderTop: '2px solid var(--cic-panel-edge)' }}>{addDaysToDate(gameDate, totals.days)}</td>}
        </tr>
      </tfoot>
    </table>
  )
}

function FleetLegTable({ legs, gameDate }: { legs: FleetRouteLeg[]; gameDate: GameDate | null }): React.JSX.Element {
  const th: React.CSSProperties = { textAlign: 'left', padding: '3px 6px', borderBottom: '1px solid var(--cic-panel-edge)', fontSize: 9, color: 'var(--cic-cyan)' }
  const thR: React.CSSProperties = { ...th, textAlign: 'right' }
  const td: React.CSSProperties = { padding: '3px 6px', borderBottom: '1px solid var(--cic-panel-edge)', fontSize: 11 }
  const tdR: React.CSSProperties = { ...td, textAlign: 'right' }
  let cumDays = 0

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead><tr>
        <th style={th}>#</th><th style={th}>From</th><th style={th}>To</th><th style={th}>Type</th>
        <th style={thR}>Distance</th><th style={thR}>Time</th>
        {gameDate && <th style={thR}>Arrival</th>}
      </tr></thead>
      <tbody>
        {legs.map((leg, i) => {
          cumDays += leg.travelDays
          const arrival = gameDate && leg.type !== 'jump' ? addDaysToDate(gameDate, cumDays) : null
          return (
            <tr key={i} style={{ opacity: leg.type === 'jump' ? 0.6 : 1 }}>
              <td style={{ ...td, color: 'var(--cic-cyan-dim)' }}>{i + 1}</td>
              <td style={td}>{leg.from.systemName}</td>
              <td style={td}>
                {leg.to.systemName}
                {leg.refuelStop && <span style={{ color: 'var(--cic-green)', fontWeight: 600, marginLeft: 4, fontSize: 9 }}>REFUEL</span>}
              </td>
              <td style={td}>{leg.type === 'jump' ? <span style={{ color: '#bc8cff', fontWeight: 600 }}>JUMP</span> : <span style={{ color: 'var(--cic-cyan-dim)' }}>transit</span>}</td>
              <td style={tdR}>{leg.type === 'jump' ? '—' : formatDistance(leg.distanceKm)}</td>
              <td style={tdR}>{leg.type === 'jump' ? '—' : `${leg.travelDays}d`}</td>
              {gameDate && <td style={{ ...tdR, color: 'var(--cic-cyan-dim)' }}>{leg.type === 'jump' ? '—' : arrival}</td>}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function ShipFuelTable({ legs, bottleneckId }: { legs: FleetRouteLeg[]; bottleneckId: number | null }): React.JSX.Element {
  const lastTransitLeg = [...legs].reverse().find((l) => l.type === 'in-system')
  if (!lastTransitLeg) return <div />

  const firstLeg = legs[0]
  const startFuelMap = new Map<number, number>()
  if (firstLeg) {
    for (const sf of firstLeg.shipFuel) {
      startFuelMap.set(sf.shipId, sf.fuelRemaining + sf.fuelBurn)
    }
  }

  const th: React.CSSProperties = { textAlign: 'left', padding: '3px 6px', borderBottom: '1px solid var(--cic-panel-edge)', fontSize: 9, color: 'var(--cic-cyan)' }
  const thR: React.CSSProperties = { ...th, textAlign: 'right' }
  const td: React.CSSProperties = { padding: '3px 6px', borderBottom: '1px solid var(--cic-panel-edge)', fontSize: 11 }
  const tdR: React.CSSProperties = { ...td, textAlign: 'right' }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead><tr>
        <th style={th}>Ship</th><th style={th}>Class</th>
        <th style={thR}>Rate</th><th style={thR}>Start</th><th style={thR}>Burn</th><th style={thR}>At Dest</th>
        <th style={{ ...th, minWidth: 80 }}>Fuel</th>
      </tr></thead>
      <tbody>
        {lastTransitLeg.shipFuel.map((sf) => {
          const isBottleneck = sf.shipId === bottleneckId
          const startFuel = startFuelMap.get(sf.shipId) ?? 0
          const totalBurn = legs.reduce((sum, leg) => {
            const entry = leg.shipFuel.find((s) => s.shipId === sf.shipId)
            return sum + (entry?.fuelBurn || 0)
          }, 0)
          const capacity = sf.fuelPct > 0 ? Math.round(Math.max(0, sf.fuelRemaining) / sf.fuelPct * 100) : startFuel
          const startPct = capacity > 0 ? Math.round((startFuel / capacity) * 100) : 0

          return (
            <tr key={sf.shipId} style={{ background: isBottleneck ? 'rgba(255,23,68,0.08)' : undefined }}>
              <td style={{ ...td, fontWeight: isBottleneck ? 600 : 400, color: isBottleneck ? 'var(--cic-red)' : undefined }}>{sf.name}</td>
              <td style={{ ...td, color: 'var(--cic-cyan-dim)' }}>{sf.className}</td>
              <td style={{ ...tdR, color: 'var(--cic-cyan-dim)' }}>{sf.burnRate} L/hr</td>
              <td style={tdR}>{startFuel.toLocaleString()} L</td>
              <td style={tdR}>{totalBurn.toLocaleString()} L</td>
              <td style={{ ...tdR, color: !sf.sufficient ? 'var(--cic-red)' : undefined, fontWeight: !sf.sufficient ? 600 : 400 }}>{sf.fuelRemaining.toLocaleString()} L</td>
              <td style={td}><DualFuelBar startPct={startPct} endPct={sf.fuelPct} insufficient={!sf.sufficient} /></td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function formatDistance(km: number): string {
  if (km > 1e9) return `${(km / 1e9).toFixed(1)}B km`
  if (km > 1e6) return `${(km / 1e6).toFixed(1)}M km`
  return `${km.toLocaleString()} km`
}

function addDaysToDate(gameDate: GameDate, days: number): string {
  const d = new Date(gameDate.year, gameDate.month - 1, gameDate.day, gameDate.hours, gameDate.minutes, gameDate.seconds)
  d.setTime(d.getTime() + days * 86400 * 1000)
  const m = d.getMonth() + 1
  const day = d.getDate()
  return `${d.getFullYear()}-${m < 10 ? '0' : ''}${m}-${day < 10 ? '0' : ''}${day}`
}
