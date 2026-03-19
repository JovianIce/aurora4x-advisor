import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { SystemMapCanvas } from '../../system-map/SystemMapCanvas'
import { SystemSelector } from '../../system-map/SystemSelector'
import { BodyListPanel } from '../../system-map/BodyListPanel'
import { DisplayOptionsPanel, DEFAULT_DISPLAY_OPTIONS, type MapDisplayOptions } from '../../system-map/DisplayOptions'
import { useMemoryBodies, type MemorySystemBody } from '../../../contexts/aurora-data-context'
import type { GameSession, SystemBody } from '@shared/types'

interface SystemMapTabProps {
  game: GameSession
}

function bodyClassToTypeId(bodyClass: string, orbitNumber: number, planetNumber: number): number {
  if (bodyClass === 'Comet') return 14
  if (bodyClass === 'Asteroid') return 1
  if (planetNumber >= 100) return bodyClass === 'Comet' ? 14 : 1

  if (orbitNumber > 0 && planetNumber < 100) {
    switch (bodyClass) {
      case 'Terrestrial': return 10
      case 'Small': return 7
      default: return 8
    }
  }

  switch (bodyClass) {
    case 'Terrestrial': return 2
    case 'DwarfPlanet': return 3
    case 'GasGiant': return 4
    case 'SuperJovian': return 5
    case 'GasDwarf': return 4
    case 'IceGiant': return 4
    default: return 2
  }
}

function toCanvasBody(mb: MemorySystemBody): SystemBody {
  return {
    SystemBodyID: mb.SystemBodyID,
    SystemID: mb.SystemID,
    Name: mb.Name,
    OrbitalDistance: mb.OrbitalDistance,
    Bearing: mb.Bearing,
    BodyClass: bodyClassToTypeId(mb.BodyClass, mb.OrbitNumber, mb.PlanetNumber),
    BodyTypeID: bodyClassToTypeId(mb.BodyClass, mb.OrbitNumber, mb.PlanetNumber),
    PlanetNumber: mb.PlanetNumber,
    OrbitNumber: mb.OrbitNumber,
    ParentBodyID: mb.ParentBodyID,
    Radius: mb.Radius,
    Xcor: mb.Xcor,
    Ycor: mb.Ycor,
    DistanceToParent: mb.DistanceToParent,
    Eccentricity: mb.Eccentricity,
    EccentricityDirection: mb.EccentricityDirection
  }
}

export function SystemMapTab({ game }: SystemMapTabProps): React.JSX.Element {
  const gameId = game.gameInfo.auroraGameId
  const raceId = game.gameInfo.auroraRaceId

  const [selectedSystemId, setSelectedSystemId] = useState<number | null>(null)
  const [displayOptions, setDisplayOptions] = useState<MapDisplayOptions>(DEFAULT_DISPLAY_OPTIONS)
  const [showDisplayOptions, setShowDisplayOptions] = useState(false)
  const [showBodyList, setShowBodyList] = useState(true)
  const { data: memoryBodies, isLoading } = useMemoryBodies(selectedSystemId)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 })

  const updateDimensions = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      setDimensions({ width: rect.width, height: rect.height })
    }
  }, [])

  useEffect(() => {
    updateDimensions()
    const observer = new ResizeObserver(updateDimensions)
    if (containerRef.current) observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [updateDimensions])

  const bodies = useMemo(() => {
    if (!memoryBodies) return undefined
    return memoryBodies.map(toCanvasBody)
  }, [memoryBodies])

  if (!gameId || !raceId) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: 'var(--cic-cyan-dim)' }}>
        <span className="cic-data">AWAITING GAME DATA LINK...</span>
      </div>
    )
  }

  return (
    <div className="relative h-full flex">
      {/* Left: Body List Panel (collapsible) */}
      {showBodyList && memoryBodies && memoryBodies.length > 0 && (
        <div
          className="flex-shrink-0 overflow-hidden cic-animate-in"
          style={{
            width: '220px',
            background: 'linear-gradient(180deg, var(--cic-panel) 0%, var(--cic-deep) 100%)',
            borderRight: '1px solid var(--cic-panel-edge)'
          }}
        >
          <div className="cic-panel-header">
            System Bodies
            <span style={{ marginLeft: 'auto', color: 'var(--cic-cyan)' }}>
              {memoryBodies.length}
            </span>
          </div>
          <div className="overflow-y-auto" style={{ height: 'calc(100% - 30px)' }}>
            <BodyListPanel bodies={memoryBodies} />
          </div>
        </div>
      )}

      {/* Main map area */}
      <div ref={containerRef} className="flex-1 relative cic-map-bg">
        {/* Top overlay bar */}
        <div
          className="absolute top-0 left-0 right-0 z-10 flex items-center gap-2 px-3 py-2"
          style={{
            background: 'linear-gradient(180deg, rgba(3,8,16,0.9) 0%, transparent 100%)'
          }}
        >
          <button
            className={`cic-btn ${showBodyList ? 'active' : ''}`}
            onClick={() => setShowBodyList(!showBodyList)}
            title="Toggle body list"
          >
            {showBodyList ? '◂' : '▸'} Bodies
          </button>

          <SystemSelector
            value={selectedSystemId}
            onChange={setSelectedSystemId}
            gameId={gameId}
            raceId={raceId}
          />

          <button
            className={`cic-btn ${showDisplayOptions ? 'active' : ''}`}
            onClick={() => setShowDisplayOptions(!showDisplayOptions)}
          >
            Display
          </button>

          <div className="flex-1" />

          {isLoading && (
            <span className="cic-label" style={{ color: 'var(--cic-amber)' }}>
              LOADING...
            </span>
          )}
          {bodies && (
            <span className="cic-label">
              {bodies.length} tracked objects
            </span>
          )}
        </div>

        {/* Display options overlay */}
        {showDisplayOptions && (
          <div
            className="absolute top-10 left-3 z-20 cic-panel cic-animate-in"
            style={{ minWidth: '360px' }}
          >
            <div className="cic-panel-header">Display Filters</div>
            <DisplayOptionsPanel options={displayOptions} onChange={setDisplayOptions} />
          </div>
        )}

        {/* Map canvas */}
        {bodies && bodies.length > 0 ? (
          <SystemMapCanvas
            bodies={bodies}
            width={dimensions.width}
            height={dimensions.height}
            displayOptions={displayOptions}
          />
        ) : !selectedSystemId ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="cic-label" style={{ fontSize: '12px', marginBottom: '8px' }}>
                No system selected
              </div>
              <div className="cic-data" style={{ color: 'var(--cic-cyan-dim)', fontSize: '10px' }}>
                Select a star system from the dropdown above
              </div>
            </div>
          </div>
        ) : null}

        {/* Bottom HUD */}
        <div
          className="absolute bottom-0 left-0 right-0 z-10 flex items-center justify-between px-3 py-1.5"
          style={{
            background: 'linear-gradient(0deg, rgba(3,8,16,0.85) 0%, transparent 100%)'
          }}
        >
          <span className="cic-label">
            {game.gameInfo.gameName}
          </span>
          <span className="cic-label" style={{ color: 'var(--cic-amber-dim)' }}>
            AURORA CIC v1.0
          </span>
        </div>
      </div>
    </div>
  )
}
