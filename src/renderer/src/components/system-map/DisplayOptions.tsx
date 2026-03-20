import React from 'react'

export interface MapDisplayOptions {
  showPlanets: boolean
  showDwarfPlanets: boolean
  showMoons: boolean
  showAsteroids: boolean
  showComets: boolean
  showStarOrbits: boolean
  showPlanetOrbits: boolean
  showDwarfOrbits: boolean
  showMoonOrbits: boolean
  showAsteroidOrbits: boolean
  showCometOrbits: boolean
  showStarNames: boolean
  showPlanetNames: boolean
  showDwarfNames: boolean
  showMoonNames: boolean
  showAsteroidNames: boolean
  showCometNames: boolean
  showCivilianFleets: boolean
  showMilitaryFleets: boolean
  showFleetNames: boolean
}

export const DEFAULT_DISPLAY_OPTIONS: MapDisplayOptions = {
  showPlanets: true,
  showDwarfPlanets: true,
  showMoons: true,
  showAsteroids: true,
  showComets: true,
  showStarOrbits: true,
  showPlanetOrbits: true,
  showDwarfOrbits: false,
  showMoonOrbits: true,
  showAsteroidOrbits: false,
  showCometOrbits: false,
  showStarNames: true,
  showPlanetNames: true,
  showDwarfNames: true,
  showMoonNames: true,
  showAsteroidNames: true,
  showCometNames: true,
  showCivilianFleets: false,
  showMilitaryFleets: true,
  showFleetNames: true
}

function CICToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }): React.JSX.Element {
  return (
    <label className="cic-toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className={`cic-toggle-label ${checked ? 'checked' : ''}`}>{label}</span>
    </label>
  )
}

interface DisplayOptionsPanelProps {
  options: MapDisplayOptions
  onChange: (options: MapDisplayOptions) => void
}

export function DisplayOptionsPanel({ options, onChange }: DisplayOptionsPanelProps): React.JSX.Element {
  const set = (key: keyof MapDisplayOptions, value: boolean): void => {
    onChange({ ...options, [key]: value })
  }

  return (
    <div className="grid grid-cols-4 gap-x-4 gap-y-0 p-3">
      <div>
        <div className="cic-label mb-1" style={{ fontSize: '8px' }}>Bodies</div>
        <CICToggle label="Planets" checked={options.showPlanets} onChange={(v) => set('showPlanets', v)} />
        <CICToggle label="Dwarf Planets" checked={options.showDwarfPlanets} onChange={(v) => set('showDwarfPlanets', v)} />
        <CICToggle label="Moons" checked={options.showMoons} onChange={(v) => set('showMoons', v)} />
        <CICToggle label="Asteroids" checked={options.showAsteroids} onChange={(v) => set('showAsteroids', v)} />
        <CICToggle label="Comets" checked={options.showComets} onChange={(v) => set('showComets', v)} />
      </div>
      <div>
        <div className="cic-label mb-1" style={{ fontSize: '8px' }}>Orbits</div>
        <CICToggle label="Planet Orbits" checked={options.showPlanetOrbits} onChange={(v) => set('showPlanetOrbits', v)} />
        <CICToggle label="Dwarf Orbits" checked={options.showDwarfOrbits} onChange={(v) => set('showDwarfOrbits', v)} />
        <CICToggle label="Moon Orbits" checked={options.showMoonOrbits} onChange={(v) => set('showMoonOrbits', v)} />
        <CICToggle label="Asteroid Orbits" checked={options.showAsteroidOrbits} onChange={(v) => set('showAsteroidOrbits', v)} />
        <CICToggle label="Comet Orbits" checked={options.showCometOrbits} onChange={(v) => set('showCometOrbits', v)} />
        <CICToggle label="Star Orbits" checked={options.showStarOrbits} onChange={(v) => set('showStarOrbits', v)} />
      </div>
      <div>
        <div className="cic-label mb-1" style={{ fontSize: '8px' }}>Names</div>
        <CICToggle label="Star Names" checked={options.showStarNames} onChange={(v) => set('showStarNames', v)} />
        <CICToggle label="Planet Names" checked={options.showPlanetNames} onChange={(v) => set('showPlanetNames', v)} />
        <CICToggle label="Dwarf Names" checked={options.showDwarfNames} onChange={(v) => set('showDwarfNames', v)} />
        <CICToggle label="Moon Names" checked={options.showMoonNames} onChange={(v) => set('showMoonNames', v)} />
        <CICToggle label="Asteroid Names" checked={options.showAsteroidNames} onChange={(v) => set('showAsteroidNames', v)} />
        <CICToggle label="Comet Names" checked={options.showCometNames} onChange={(v) => set('showCometNames', v)} />
      </div>
      <div>
        <div className="cic-label mb-1" style={{ fontSize: '8px' }}>Fleets</div>
        <CICToggle label="Military" checked={options.showMilitaryFleets} onChange={(v) => set('showMilitaryFleets', v)} />
        <CICToggle label="Civilian" checked={options.showCivilianFleets} onChange={(v) => set('showCivilianFleets', v)} />
        <CICToggle label="Fleet Names" checked={options.showFleetNames} onChange={(v) => set('showFleetNames', v)} />
      </div>
    </div>
  )
}
