import React, { useMemo } from 'react'
import type { MemorySystemBody } from '@renderer/types/aurora'

function SectionHeader({ label }: { label: string }): React.JSX.Element {
  return (
    <div
      className="cic-label px-2.5 pt-3 pb-1"
      style={{ fontSize: '8px', borderTop: '1px solid var(--cic-panel-edge)' }}
    >
      {label}
    </div>
  )
}

interface BodyListPanelProps {
  bodies: MemorySystemBody[]
  onSelectBody?: (body: MemorySystemBody) => void
}

interface BodyGroup {
  planet: MemorySystemBody
  moons: MemorySystemBody[]
}

function getBodyTypeLabel(body: MemorySystemBody): string {
  if (body.PlanetNumber >= 100) return body.BodyClass
  if (body.OrbitNumber > 0 && body.PlanetNumber < 100) {
    switch (body.BodyClass) {
      case 'Terrestrial':
        return 'Moon - Terrestrial'
      case 'Small':
        return 'Moon - Small'
      default:
        return 'Moon'
    }
  }
  switch (body.BodyClass) {
    case 'Terrestrial':
      return 'Terrestrial'
    case 'DwarfPlanet':
      return 'Dwarf'
    case 'GasGiant':
      return 'Gas Giant'
    case 'GasDwarf':
      return 'Gas Dwarf'
    case 'IceGiant':
      return 'Ice Giant'
    case 'SuperJovian':
      return 'Super Jovian'
    default:
      return body.BodyClass
  }
}

function getBodyAccent(body: MemorySystemBody): string {
  if (body.PlanetNumber >= 100) {
    return body.BodyClass === 'Comet' ? '#00bcd4' : '#546e7a'
  }
  if (body.OrbitNumber > 0) return '#607d8b'
  switch (body.BodyClass) {
    case 'Terrestrial':
      return '#e07840'
    case 'GasGiant':
      return '#d4a030'
    case 'GasDwarf':
      return '#7e57c2'
    case 'IceGiant':
      return '#42a5f5'
    case 'DwarfPlanet':
      return '#78909c'
    case 'SuperJovian':
      return '#ffa726'
    default:
      return '#90a4ae'
  }
}

function getBodyDisplayName(body: MemorySystemBody): string {
  if (body.Name) return body.Name
  if (body.PlanetNumber > 0 && body.PlanetNumber < 100) return `Planet #${body.PlanetNumber}`
  return `Body #${body.SystemBodyID}`
}

export function BodyListPanel({ bodies, onSelectBody }: BodyListPanelProps): React.JSX.Element {
  const { groups, comets, asteroids } = useMemo(() => {
    const planets = new Map<number, BodyGroup>()
    const moonList: MemorySystemBody[] = []
    const cometList: MemorySystemBody[] = []
    const asteroidList: MemorySystemBody[] = []

    for (const body of bodies) {
      if (body.PlanetNumber >= 100) {
        if (body.BodyClass === 'Comet') cometList.push(body)
        else asteroidList.push(body)
      } else if (body.OrbitNumber === 0 && body.PlanetNumber > 0) {
        planets.set(body.PlanetNumber, { planet: body, moons: [] })
      } else if (body.OrbitNumber > 0) {
        moonList.push(body)
      }
    }

    for (const moon of moonList) {
      const group = planets.get(moon.PlanetNumber)
      if (group) group.moons.push(moon)
    }

    for (const group of planets.values()) {
      group.moons.sort((a, b) => a.OrbitNumber - b.OrbitNumber)
    }

    const sortedGroups = Array.from(planets.values()).sort(
      (a, b) => a.planet.PlanetNumber - b.planet.PlanetNumber
    )

    cometList.sort((a, b) => a.OrbitNumber - b.OrbitNumber)
    asteroidList.sort((a, b) => a.OrbitNumber - b.OrbitNumber)

    return { groups: sortedGroups, comets: cometList, asteroids: asteroidList }
  }, [bodies])

  const BodyRow = ({
    body,
    indent = false
  }: {
    body: MemorySystemBody
    indent?: boolean
  }): React.JSX.Element => {
    const accent = getBodyAccent(body)
    return (
      <button
        className="w-full text-left flex items-center gap-1.5 py-1 hover:bg-white/[0.03] transition-colors"
        style={{ paddingLeft: indent ? '20px' : '10px', paddingRight: '10px' }}
        onClick={() => onSelectBody?.(body)}
      >
        <span
          className="flex-shrink-0 rounded-full"
          style={{
            width: indent ? '5px' : '6px',
            height: indent ? '5px' : '6px',
            backgroundColor: accent,
            boxShadow: `0 0 4px ${accent}40`
          }}
        />
        <span
          className="cic-data truncate flex-1"
          style={{
            color: indent ? 'rgba(255,255,255,0.4)' : accent,
            fontSize: indent ? '9px' : '10px'
          }}
        >
          {getBodyDisplayName(body)}
        </span>
        <span
          className="cic-data flex-shrink-0"
          style={{ color: 'rgba(255,255,255,0.15)', fontSize: '8px' }}
        >
          {getBodyTypeLabel(body)}
        </span>
      </button>
    )
  }

  return (
    <div className="py-1">
      {groups.map(({ planet, moons }) => (
        <React.Fragment key={planet.SystemBodyID}>
          <BodyRow body={planet} />
          {moons.map((moon) => (
            <BodyRow key={moon.SystemBodyID} body={moon} indent />
          ))}
        </React.Fragment>
      ))}

      {comets.length > 0 && (
        <>
          <SectionHeader label={`Comets (${comets.length})`} />
          {comets.map((body) => (
            <BodyRow key={body.SystemBodyID} body={body} />
          ))}
        </>
      )}

      {asteroids.length > 0 && (
        <>
          <SectionHeader label={`Asteroids (${asteroids.length})`} />
          {asteroids.map((body) => (
            <BodyRow key={body.SystemBodyID} body={body} />
          ))}
        </>
      )}
    </div>
  )
}
