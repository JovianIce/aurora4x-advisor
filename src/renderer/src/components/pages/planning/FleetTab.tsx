import React, { useState } from 'react'
import { useShips, type Ship } from '@renderer/hooks/use-data'
import { FleetTable } from './FleetTable'
import { ClassCard } from './ClassCard'
import { FuelBar, InfoCard, SectionHeader, ActionButton, Tooltip } from './ui'

function ShipDetail({
  ship,
  onViewClass,
  onSelectShip,
  onPlanRoute
}: {
  ship: Ship
  onViewClass: (classId: number) => void
  onSelectShip: (id: number) => void
  onPlanRoute: (ship: Ship) => void
}): React.JSX.Element {
  const nt = ship.nearestTanker

  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--cic-cyan)', marginBottom: 2 }}>
        {ship.name}
      </div>
      <div style={{ fontSize: 10, color: 'var(--cic-cyan-dim)', marginBottom: 4 }}>
        {ship.className} · {ship.fleet}
      </div>
      <div className="flex flex-wrap gap-1" style={{ marginBottom: 12 }}>
        {ship.military && <Tag label="Military" color="var(--cic-red)" />}
        {ship.commercial && <Tag label="Commercial" color="var(--cic-cyan-dim)" />}
        {ship.fighter && <Tag label="Fighter" color="var(--cic-red)" />}
        {ship.tanker && <Tag label="Tanker" color="var(--cic-amber)" />}
        {ship.freighter && <Tag label="Freighter" color="var(--cic-cyan)" />}
      </div>

      <SectionHeader>Position</SectionHeader>
      <div className="grid grid-cols-2 gap-2" style={{ marginBottom: 12 }}>
        <InfoCard label="Location" value={ship.system === 'Transit' ? 'In Transit' : ship.system} warn={ship.system === 'Transit'} />
        <InfoCard label="Fleet Speed" value={`${ship.speed} km/s`} />
        <InfoCard
          label="Distance to Sol"
          value={ship.jumpsToSol != null ? `${ship.jumpsToSol} jump${ship.jumpsToSol !== 1 ? 's' : ''}` : '—'}
          sub={ship.travelDaysToSol != null ? `~${ship.travelDaysToSol} days travel` : undefined}
        />
        <InfoCard
          label="Nearest Tanker"
          value={nt ? nt.name : 'None'}
          sub={nt ? `${nt.sameSystem ? 'Same system' : nt.jumps + ' jump' + (nt.jumps !== 1 ? 's' : '')}, ${nt.fuel.toLocaleString()} L` : undefined}
          onClick={nt ? () => onSelectShip(nt.shipId) : undefined}
        />
      </div>

      <SectionHeader>Fuel & Range</SectionHeader>
      <div className="grid grid-cols-2 gap-2" style={{ marginBottom: 12 }}>
        <InfoCard
          label="Fuel"
          value={ship.fuelPct != null ? `${ship.fuelPct}%` : '—'}
          sub={`${ship.fuel.toLocaleString()} / ${ship.fuelCapacity.toLocaleString()} L`}
          warn={ship.fuelPct != null && ship.fuelPct < 25}
        />
        <InfoCard label="Range" value={ship.rangeDays ? `${ship.rangeDays} days` : '—'} warn={ship.rangeDays != null && ship.rangeDays < 30} />
      </div>

      {(ship.military || ship.fighter) && !ship.commercial && (
        <>
          <SectionHeader>Deployment</SectionHeader>
          <div className="grid grid-cols-3 gap-2" style={{ marginBottom: 12 }}>
            <InfoCard
              label="Deploy Left"
              value={ship.fighter ? 'Exempt' : ship.deploymentRemaining != null ? `${ship.deploymentRemaining}mo` : '—'}
              warn={!ship.fighter && ship.deploymentRemaining != null && ship.deploymentRemaining < 6}
              crit={!ship.fighter && ship.deploymentRemaining != null && ship.deploymentRemaining < 0}
            />
            <InfoCard
              label="Overhaul"
              value={ship.fighter ? 'Exempt' : `${ship.monthsSinceOverhaul}mo`}
              warn={!ship.fighter && ship.monthsSinceOverhaul > 30}
              crit={!ship.fighter && ship.monthsSinceOverhaul > 40}
            />
            <InfoCard label="Maint" value={ship.maintenanceState > 0 ? `State ${ship.maintenanceState}` : 'OK'} crit={ship.maintenanceState > 0} />
          </div>
        </>
      )}

      <SectionHeader>Actions</SectionHeader>
      <div className="flex gap-2">
        <ActionButton label="Plan Route" onClick={() => onPlanRoute(ship)} />
        <ActionButton label="View Class" onClick={() => onViewClass(ship.shipClassId)} />
      </div>
    </div>
  )
}

const FLEET_STORAGE_KEY = 'aurora-planning-fleet'

export function FleetTab({ active = true, onPlanRoute }: { active?: boolean; onPlanRoute?: (ship: Ship) => void }): React.JSX.Element {
  const { data, isLoading, error } = useShips(active)
  const savedFleet = (() => {
    try { return JSON.parse(localStorage.getItem(FLEET_STORAGE_KEY) || '{}') }
    catch { return {} }
  })()
  const [selectedShipId, setSelectedShipIdRaw] = useState<number | null>(savedFleet.selectedShipId ?? null)
  const [viewingClassId, setViewingClassId] = useState<number | null>(null)

  const setSelectedShipId = (v: number | null): void => {
    setSelectedShipIdRaw(v)
    localStorage.setItem(FLEET_STORAGE_KEY, JSON.stringify({ selectedShipId: v }))
  }

  if (isLoading)
    return <div className="flex items-center justify-center h-full" style={{ color: 'var(--cic-cyan-dim)' }}>Loading fleet data...</div>
  if (error)
    return <div className="flex items-center justify-center h-full" style={{ color: 'var(--cic-red)' }}>Bridge error. Is Aurora running?</div>
  if (!data) return <div />

  const selectedShip = selectedShipId ? data.ships.find((s) => s.shipId === selectedShipId) ?? null : null

  return (
    <div className="flex h-full">
      <div className="flex-1 min-w-0 flex flex-col">
        <FleetTable
          ships={data.ships}
          onSelectShip={(s) => { setSelectedShipId(s.shipId); setViewingClassId(null) }}
          selectedShipId={selectedShipId}
        />
      </div>
      <div
        className="overflow-y-auto p-3"
        style={{ width: 320, minWidth: 320, borderLeft: '1px solid var(--cic-panel-edge)' }}
      >
        {viewingClassId ? (
          <ClassCard classId={viewingClassId} onClose={() => setViewingClassId(null)} />
        ) : selectedShip ? (
          <ShipDetail
            ship={selectedShip}
            onViewClass={setViewingClassId}
            onSelectShip={(id) => { setSelectedShipId(id); setViewingClassId(null) }}
            onPlanRoute={onPlanRoute || (() => {})}
          />
        ) : (
          <div className="flex items-center justify-center h-full" style={{ fontSize: 11, color: 'var(--cic-cyan-dim)' }}>
            Select a ship to view details
          </div>
        )}
      </div>
    </div>
  )
}

const TAG_TOOLTIPS: Record<string, string> = {
  Military: 'Uses military engines (class design)',
  Commercial: 'Commercial-rated hull (class design)',
  Fighter: 'Fighter-class vessel (class design)',
  Tanker: 'Fuel tanker flag set (class design)',
  Freighter: 'Cargo capacity > 25% of tonnage'
}

function Tag({ label, color }: { label: string; color: string }): React.JSX.Element {
  return (
    <Tooltip text={TAG_TOOLTIPS[label] || label}>
      <span
        style={{
          fontSize: 8,
          padding: '1px 5px',
          borderRadius: 8,
          background: `color-mix(in srgb, ${color} 15%, transparent)`,
          color,
          fontWeight: 600
        }}
      >
        {label}
      </span>
    </Tooltip>
  )
}
