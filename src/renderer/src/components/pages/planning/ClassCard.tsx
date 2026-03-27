import React from 'react'
import { useClassDetail, type ShipClassData, type ClassComponent } from '@renderer/hooks/use-data'

interface ClassCardProps {
  classId: number
  onClose: () => void
}

export function ClassCard({ classId, onClose }: ClassCardProps): React.JSX.Element {
  const { data, isLoading, error } = useClassDetail(classId)

  if (isLoading) return <div style={{ padding: 12, color: 'var(--cic-cyan-dim)' }}>Loading class data...</div>
  if (error || !data) return <div style={{ padding: 12, color: 'var(--cic-red)' }}>Failed to load class</div>

  const c = data.class
  const comps = data.components

  const tcs = Math.round(c.Tonnage / 50)
  const burnRate = c.EnginePower * c.FuelEfficiency
  const rangeBkm = burnRate > 0 ? (c.FuelCapacity / burnRate) * c.MaxSpeed * 3.6 / 1e9 : 0
  const rangeDays = burnRate > 0 ? (c.FuelCapacity / burnRate) / 3600 / 24 : 0
  const totalHTK = comps.reduce((sum, comp) => sum + comp.HTK * Math.floor(comp.NumComponent), 0) + c.ArmourThickness * c.ArmourWidth

  const engines = comps.filter(x => x.Name.includes('Drive') || x.Name.includes('Engine'))
  const jumpDrives = comps.filter(x => x.Name.includes('Jump Drive'))
  const weapons = comps.filter(x => x.Weapon || x.Name.includes('Launcher'))
  const fireControls = comps.filter(x => x.Name.includes('Fire Control'))
  const sensors = comps.filter(x => x.Name.includes('Sensor'))
  const shields = comps.filter(x => x.Name.includes('Shield'))
  const hangars = comps.filter(x => x.Name.includes('Hangar') || x.Name.includes('Boat Bay'))
  const other = comps.filter(x =>
    !engines.includes(x) && !jumpDrives.includes(x) && !weapons.includes(x) &&
    !fireControls.includes(x) && !sensors.includes(x) && !shields.includes(x) && !hangars.includes(x)
  )

  const stations: string[] = []
  if (comps.some(x => x.Name === 'Bridge')) stations.push('BRG')
  if (comps.some(x => x.Name === 'Auxiliary Control')) stations.push('AUX')
  if (comps.some(x => x.Name === 'Main Engineering')) stations.push('ENG')
  if (comps.some(x => x.Name === 'Combat Information Centre')) stations.push('CIC')
  if (comps.some(x => x.Name.includes('Flight Control'))) stations.push('FLT')
  if (comps.some(x => x.Name.includes('Flag Bridge'))) stations.push('FLG')

  const s = (v: string | number): React.JSX.Element => <span style={{ color: 'var(--foreground)' }}>{v}</span>
  const a = (v: string | number): React.JSX.Element => <span style={{ color: 'var(--cic-cyan)' }}>{v}</span>

  return (
    <div style={{ fontSize: 11 }}>
      <div className="flex items-start justify-between" style={{ marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--cic-cyan)' }}>{c.ClassName}</div>
          <div style={{ fontSize: 10, color: 'var(--cic-cyan-dim)' }}>
            {c.FighterClass ? 'Fighter' : c.Commercial ? 'Commercial' : 'Military'} Vessel
            {c.Locked ? ' — Locked' : ' — Unlocked'}
          </div>
        </div>
        <button onClick={onClose} className="cursor-pointer" style={{ border: 'none', background: 'transparent', color: 'var(--cic-cyan-dim)', fontSize: 14 }}>×</button>
      </div>

      <div style={{ background: 'var(--cic-panel)', border: '1px solid var(--cic-panel-edge)', borderRadius: 4, padding: 8, marginBottom: 8, fontFamily: 'monospace', lineHeight: 1.6, fontSize: 10 }}>
        <div>{a(c.ClassName)} class — {s(Math.round(c.Tonnage).toLocaleString())} tons — {s(c.Crew)} Crew — {s(Math.round(c.BuildPointCost).toLocaleString())} BP — TCS {s(tcs)} TH {s(c.EnginePower)} EM {s(c.ShieldStrength > 0 ? c.ShieldStrength : 0)}</div>
        <div>
          {s(c.MaxSpeed)} km/s
          {c.JumpDistance > 0 && <> — JR {s(`4-${c.JumpDistance}`)}</>}
          {' '}— Armour {s(`${c.ArmourThickness}-${c.ArmourWidth}`)}
          {' '}— Shields {s(`${c.ShieldStrength}-0`)}
          {' '}— HTK {s(totalHTK)}
          {' '}— Sensors {s(`${c.PassiveSensorStrength}/${Math.round(c.EMSensorStrength * 10) / 10}/0/0`)}
          {' '}— DCR {s(c.DCRating)}
        </div>
        <div>
          Control Rating {s(c.ControlRating)} — {stations.join('   ')}
          {' '}— Deploy: {s(c.PlannedDeployment)} months
          {c.STSTractor > 0 && ' — Tractor Beam'}
        </div>
        {c.MaintSupplies > 0 && <div>MSP {s(c.MaintSupplies.toLocaleString())}</div>}
        {hangars.length > 0 && (
          <div>
            Hangar Capacity {s(hangars.reduce((sum, h) => sum + h.Tons * Math.floor(h.NumComponent), 0).toLocaleString())} tons
            {c.MagazineCapacity > 0 && <> — Magazine {s(c.MagazineCapacity)}</>}
          </div>
        )}
      </div>

      {jumpDrives.length > 0 && <CompSection title="Jump Drive" items={jumpDrives} />}
      {engines.length > 0 && <CompSection title="Propulsion" items={engines} extra={
        <div style={{ color: 'var(--cic-cyan-dim)', marginTop: 2, fontSize: 10 }}>
          Fuel {c.FuelCapacity.toLocaleString()} L — Range {rangeBkm.toFixed(1)}B km ({Math.round(rangeDays)} days)
        </div>
      } />}
      {weapons.length > 0 && <CompSection title="Weapons" items={[...weapons, ...fireControls]} />}
      {sensors.length > 0 && <CompSection title="Sensors" items={sensors} />}
      {shields.length > 0 && <CompSection title="Shields" items={shields} />}
      {hangars.length > 0 && <CompSection title="Hangars" items={hangars} />}
      {other.length > 0 && <CompSection title="Other" items={other} />}
    </div>
  )
}

function CompSection({ title, items, extra }: { title: string; items: ClassComponent[]; extra?: React.ReactNode }): React.JSX.Element {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 9, color: 'var(--cic-cyan)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
        {title}
      </div>
      {items.map((comp, i) => (
        <div key={i} className="flex items-center justify-between" style={{ padding: '2px 0', borderBottom: '1px solid var(--cic-panel-edge)', opacity: 0.9, fontSize: 11 }}>
          <span>
            {comp.Name}
            {Math.floor(comp.NumComponent) > 1 && <span style={{ color: 'var(--cic-cyan-dim)' }}> (×{Math.floor(comp.NumComponent)})</span>}
          </span>
          <span style={{ color: 'var(--cic-cyan-dim)', fontSize: 9 }}>
            {comp.Tons}t
            {comp.HTK > 0 && <> HTK {comp.HTK}</>}
            {comp.CompCrew > 0 && <> {comp.CompCrew}crew</>}
          </span>
        </div>
      ))}
      {extra}
    </div>
  )
}
