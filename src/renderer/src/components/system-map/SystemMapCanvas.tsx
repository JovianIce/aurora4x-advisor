import React, { useRef, useEffect, useCallback, useReducer } from 'react'
import type { SystemBody } from '@shared/types'
import type { MemoryFleet } from '../../contexts/aurora-data-context'

interface EnrichedFleet extends MemoryFleet {
  order?: string
  distance?: number
  eta?: string
}
import { auToCanvas, type ViewportState, type CartesianPoint } from '../../lib/orbital-math'
import type { MapDisplayOptions } from './DisplayOptions'

interface SystemMapCanvasProps {
  bodies: SystemBody[]
  fleets?: EnrichedFleet[]
  width: number
  height: number
  displayOptions: MapDisplayOptions
}

type ViewportAction =
  | { type: 'zoom'; delta: number; mouseX: number; mouseY: number }
  | { type: 'pan'; dx: number; dy: number }
  | { type: 'resize'; width: number; height: number }
  | { type: 'reset'; width: number; height: number }

const KM_PER_AU = 149_597_870.7
const MOON_ZOOM_THRESHOLD = 15000 // px/AU — moons only visible past this zoom level

// Bodies with PlanetNumber >= 100 are comets/asteroids — they orbit the star, not a planet
function isMoon(body: SystemBody): boolean {
  return body.OrbitNumber > 0 && body.PlanetNumber < 100
}

function viewportReducer(state: ViewportState, action: ViewportAction): ViewportState {
  switch (action.type) {
    case 'zoom': {
      const factor = action.delta > 0 ? 0.85 : 1.18
      const newScale = Math.max(0.001, Math.min(state.scale * factor, 1e8))
      const mouseAuX = (action.mouseX - state.canvasWidth / 2) / state.scale + state.centerX
      const mouseAuY = (action.mouseY - state.canvasHeight / 2) / state.scale + state.centerY
      const newCenterX = mouseAuX - (action.mouseX - state.canvasWidth / 2) / newScale
      const newCenterY = mouseAuY - (action.mouseY - state.canvasHeight / 2) / newScale
      return { ...state, scale: newScale, centerX: newCenterX, centerY: newCenterY }
    }
    case 'pan':
      return {
        ...state,
        centerX: state.centerX - action.dx / state.scale,
        centerY: state.centerY - action.dy / state.scale
      }
    case 'resize':
      return { ...state, canvasWidth: action.width, canvasHeight: action.height }
    case 'reset':
      return {
        centerX: 0,
        centerY: 0,
        scale: 100,
        canvasWidth: action.width,
        canvasHeight: action.height
      }
  }
}

// Classify body for display option checks
function getBodyCategory(body: SystemBody): 'planet' | 'dwarf' | 'moon' | 'asteroid' | 'comet' {
  if (body.PlanetNumber >= 100) {
    return body.BodyTypeID === 14 ? 'comet' : 'asteroid'
  }
  if (isMoon(body)) return 'moon'
  if (body.BodyTypeID === 3) return 'dwarf' // Dwarf planet
  return 'planet'
}

function shouldShowBody(body: SystemBody, opts: MapDisplayOptions, scale?: number): boolean {
  switch (getBodyCategory(body)) {
    case 'planet':
      return opts.showPlanets
    case 'dwarf':
      return opts.showDwarfPlanets
    case 'moon':
      return opts.showMoons && (!scale || scale >= MOON_ZOOM_THRESHOLD)
    case 'asteroid':
      return opts.showAsteroids
    case 'comet':
      return opts.showComets
  }
}

function shouldShowOrbit(body: SystemBody, opts: MapDisplayOptions): boolean {
  switch (getBodyCategory(body)) {
    case 'planet':
      return opts.showPlanetOrbits
    case 'dwarf':
      return opts.showDwarfOrbits
    case 'moon':
      return opts.showMoonOrbits
    case 'asteroid':
      return opts.showAsteroidOrbits
    case 'comet':
      return opts.showCometOrbits
  }
}

function shouldShowName(body: SystemBody, opts: MapDisplayOptions): boolean {
  switch (getBodyCategory(body)) {
    case 'planet':
      return opts.showPlanetNames
    case 'dwarf':
      return opts.showDwarfNames
    case 'moon':
      return opts.showMoonNames
    case 'asteroid':
      return opts.showAsteroidNames
    case 'comet':
      return opts.showCometNames
  }
}

export function SystemMapCanvas({
  bodies,
  fleets,
  width,
  height,
  displayOptions
}: SystemMapCanvasProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDragging = useRef(false)
  const lastMouse = useRef({ x: 0, y: 0 })
  const animFrameRef = useRef<number>(0)

  const positions = useRef(new Map<number, CartesianPoint>())

  const [viewport, dispatch] = useReducer(viewportReducer, {
    centerX: 0,
    centerY: 0,
    scale: 100,
    canvasWidth: width,
    canvasHeight: height
  })

  useEffect(() => {
    dispatch({ type: 'resize', width, height })
  }, [width, height])

  // Update positions directly from data
  useEffect(() => {
    const newPositions = new Map<number, CartesianPoint>()
    for (const body of bodies) {
      newPositions.set(body.SystemBodyID, {
        x: body.Xcor / KM_PER_AU,
        y: body.Ycor / KM_PER_AU
      })
    }
    positions.current = newPositions
  }, [bodies])

  // Set canvas size only when dimensions change
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
  }, [width, height])

  // Render loop at 60fps with smooth animation
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    function draw(): void {
      const ctx = canvas!.getContext('2d')
      if (!ctx) return

      const dpr = window.devicePixelRatio || 1
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      // Use real positions directly - no interpolation
      const posMap = positions.current

      // Background — CIC void
      ctx.fillStyle = '#030810'
      ctx.fillRect(0, 0, width, height)

      // Star at center — CIC amber glow
      const starScreen = auToCanvas({ x: 0, y: 0 }, viewport)

      // Glow halo
      const starGlow = ctx.createRadialGradient(
        starScreen.cx,
        starScreen.cy,
        0,
        starScreen.cx,
        starScreen.cy,
        20
      )
      starGlow.addColorStop(0, 'rgba(255, 179, 0, 0.3)')
      starGlow.addColorStop(0.5, 'rgba(255, 179, 0, 0.05)')
      starGlow.addColorStop(1, 'transparent')
      ctx.fillStyle = starGlow
      ctx.fillRect(starScreen.cx - 20, starScreen.cy - 20, 40, 40)

      ctx.beginPath()
      ctx.arc(starScreen.cx, starScreen.cy, 5, 0, Math.PI * 2)
      ctx.fillStyle = '#ffb300'
      ctx.fill()

      if (displayOptions.showStarNames) {
        ctx.fillStyle = 'rgba(255, 179, 0, 0.7)'
        ctx.font = '10px Consolas, monospace'
        ctx.fillText('Star', starScreen.cx + 10, starScreen.cy + 3)
      }

      // Map PlanetNumber -> parent body (for moon orbit drawing)
      const planetByNumber = new Map<number, SystemBody>()
      for (const body of bodies) {
        if (!isMoon(body) && body.PlanetNumber > 0 && body.PlanetNumber < 100) {
          planetByNumber.set(body.PlanetNumber, body)
        }
      }

      // Draw orbits (elliptical using Eccentricity)
      for (const body of bodies) {
        if (!shouldShowBody(body, displayOptions, viewport.scale)) continue
        if (!shouldShowOrbit(body, displayOptions)) continue

        if (!isMoon(body)) {
          const a = body.OrbitalDistance // semi-major axis in AU
          const e = body.Eccentricity || 0
          const b = a * Math.sqrt(1 - e * e) // semi-minor axis
          const c = a * e // distance from center to focus (star)

          const semiMajorPx = a * viewport.scale
          const semiMinorPx = b * viewport.scale

          if (semiMajorPx > 2 && semiMajorPx < width * 3) {
            // EccentricityDirection is the angle of periapsis from the star
            // The ellipse center is offset from the star (focus) by c along that direction
            const dirRad = ((body.EccentricityDirection || 0) * Math.PI) / 180
            const offsetPx = c * viewport.scale

            // Ellipse center = star + offset along eccentricity direction
            // Using same coordinate system as body positions (cos for x, y direct)
            const ellipseCx = starScreen.cx + Math.cos(dirRad) * offsetPx
            const ellipseCy = starScreen.cy + Math.sin(dirRad) * offsetPx

            ctx.strokeStyle = 'rgba(0, 229, 255, 0.06)'
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.ellipse(ellipseCx, ellipseCy, semiMajorPx, semiMinorPx, dirRad, 0, Math.PI * 2)
            ctx.stroke()
          }
        } else {
          const parent = planetByNumber.get(body.PlanetNumber)
          if (parent) {
            const parentPos = posMap.get(parent.SystemBodyID)
            if (parentPos) {
              const parentScreen = auToCanvas(parentPos, viewport)
              const moonOrbitRadius = (body.DistanceToParent / KM_PER_AU) * viewport.scale
              if (moonOrbitRadius > 1 && moonOrbitRadius < width * 2) {
                ctx.strokeStyle = 'rgba(0, 229, 255, 0.04)'
                ctx.lineWidth = 1
                ctx.beginPath()
                ctx.arc(parentScreen.cx, parentScreen.cy, moonOrbitRadius, 0, Math.PI * 2)
                ctx.stroke()
              }
            }
          }
        }
      }

      // --- Build fleet groups keyed by screen pixel for label stacking ---
      const SNAP = 10 // px — fleets within this distance share a group
      const LINE_H = 11

      type FleetScreenItem = {
        fleet: typeof fleets extends (infer T)[] | undefined ? T : never
        cx: number
        cy: number
      }
      const visibleFleetItems: FleetScreenItem[] = []

      if (fleets && fleets.length > 0) {
        for (const fleet of fleets) {
          if (!fleet.Xcor && !fleet.Ycor) continue
          if (fleet.IsCivilian && !displayOptions.showCivilianFleets) continue
          if (!fleet.IsCivilian && !displayOptions.showMilitaryFleets) continue

          const fleetAu = { x: fleet.Xcor / KM_PER_AU, y: fleet.Ycor / KM_PER_AU }
          const screen = auToCanvas(fleetAu, viewport)
          if (
            screen.cx < -100 ||
            screen.cx > width + 100 ||
            screen.cy < -100 ||
            screen.cy > height + 100
          )
            continue

          visibleFleetItems.push({ fleet, cx: screen.cx, cy: screen.cy })
        }
      }

      // Group fleets by proximity
      type FleetGroup = { cx: number; cy: number; fleets: FleetScreenItem['fleet'][] }
      const fleetGroups: FleetGroup[] = []
      for (const item of visibleFleetItems) {
        let found = false
        for (const g of fleetGroups) {
          if (Math.abs(g.cx - item.cx) < SNAP && Math.abs(g.cy - item.cy) < SNAP) {
            g.fleets.push(item.fleet)
            found = true
            break
          }
        }
        if (!found) {
          fleetGroups.push({ cx: item.cx, cy: item.cy, fleets: [item.fleet] })
        }
      }

      // Draw body dots (no labels yet)
      for (const body of bodies) {
        if (!shouldShowBody(body, displayOptions, viewport.scale)) continue
        const pos = posMap.get(body.SystemBodyID)
        if (!pos) continue
        const screen = auToCanvas(pos, viewport)
        if (screen.cx < -50 || screen.cx > width + 50 || screen.cy < -50 || screen.cy > height + 50)
          continue

        const moon = isMoon(body)
        const radius = moon ? 2.5 : 4
        ctx.beginPath()
        ctx.arc(screen.cx, screen.cy, radius, 0, Math.PI * 2)
        ctx.fillStyle = getBodyColor(body.BodyClass)
        ctx.fill()
      }

      // Draw fleet diamond icons
      for (const group of fleetGroups) {
        const { cx, cy } = group
        const hasMoving = group.fleets.some((f) => f.Speed > 1)
        const s = 5
        ctx.beginPath()
        ctx.moveTo(cx, cy - s)
        ctx.lineTo(cx + s, cy)
        ctx.lineTo(cx, cy + s)
        ctx.lineTo(cx - s, cy)
        ctx.closePath()
        ctx.fillStyle = hasMoving ? '#00e676' : 'rgba(0, 230, 118, 0.5)'
        ctx.fill()
        ctx.strokeStyle = hasMoving ? 'rgba(0, 230, 118, 0.8)' : 'rgba(0, 230, 118, 0.3)'
        ctx.lineWidth = 1
        ctx.stroke()
      }

      // --- Combined label pass: fleet names stacked above, body name below ---
      // Like Aurora: stationary fleets first, then moving, then body name at the bottom
      for (const body of bodies) {
        if (!shouldShowBody(body, displayOptions, viewport.scale)) continue
        const pos = posMap.get(body.SystemBodyID)
        if (!pos) continue
        const screen = auToCanvas(pos, viewport)
        if (screen.cx < -50 || screen.cx > width + 50 || screen.cy < -50 || screen.cy > height + 50)
          continue

        const moon = isMoon(body)
        const showName = shouldShowName(body, displayOptions)

        // Find fleet group near this body
        const nearGroup = fleetGroups.find(
          (g) => Math.abs(g.cx - screen.cx) < SNAP && Math.abs(g.cy - screen.cy) < SNAP
        )

        const labelX = screen.cx + 8
        let labelY = screen.cy + (moon ? 4 : 6)

        // Fleet labels above body name (sorted: stationary first, then moving)
        if (nearGroup && displayOptions.showFleetNames) {
          const sorted = [...nearGroup.fleets].sort(fleetSortComparator)

          // Start above: fleet labels go upward from the body position
          const fleetStartY = labelY - LINE_H * sorted.length
          let fy = fleetStartY
          ctx.font = '9px Consolas, monospace'

          for (const fleet of sorted) {
            const isMoving = fleet.Speed > 1
            ctx.fillStyle = isMoving ? 'rgba(0, 230, 118, 0.8)' : 'rgba(0, 230, 118, 0.5)'
            ctx.fillText(buildFleetLabel(fleet), labelX, fy)
            fy += LINE_H
          }

          // Remove group so we don't draw it again for orphan fleets
          const idx = fleetGroups.indexOf(nearGroup)
          if (idx >= 0) fleetGroups.splice(idx, 1)
        }

        // Body name at the bottom
        if (showName) {
          ctx.fillStyle = moon ? 'rgba(0, 229, 255, 0.35)' : 'rgba(0, 229, 255, 0.6)'
          ctx.font = moon ? '8px Consolas, monospace' : '9px Consolas, monospace'
          ctx.fillText(body.Name || `Body ${body.SystemBodyID}`, labelX, labelY)
        }
      }

      // Orphan fleet groups (not near any body) — draw labels standalone
      for (const group of fleetGroups) {
        if (!displayOptions.showFleetNames) continue
        const { cx, cy } = group
        const sorted = [...group.fleets].sort(fleetSortComparator)
        let fy = cy - Math.floor(((sorted.length - 1) * LINE_H) / 2) + 3
        ctx.font = '9px Consolas, monospace'
        for (const fleet of sorted) {
          const isMoving = fleet.Speed > 1
          ctx.fillStyle = isMoving ? 'rgba(0, 230, 118, 0.8)' : 'rgba(0, 230, 118, 0.5)'
          ctx.fillText(buildFleetLabel(fleet), cx + 8, fy)
          fy += LINE_H
        }
      }

      // HUD — rendered in canvas for crisp overlay
      ctx.fillStyle = 'rgba(0, 229, 255, 0.25)'
      ctx.font = '9px Consolas, monospace'
      ctx.fillText(`SCALE ${formatScale(viewport.scale)}`, 10, height - 8)

      animFrameRef.current = requestAnimationFrame(draw)
    }

    animFrameRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [bodies, fleets, viewport, width, height, displayOptions])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true
    lastMouse.current = { x: e.clientX, y: e.clientY }
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return
    const dx = e.clientX - lastMouse.current.x
    const dy = e.clientY - lastMouse.current.y
    lastMouse.current = { x: e.clientX, y: e.clientY }
    dispatch({ type: 'pan', dx, dy })
  }, [])

  const handleMouseUp = useCallback(() => {
    isDragging.current = false
  }, [])

  // Attach wheel listener with passive:false so preventDefault works
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const onWheel = (e: WheelEvent): void => {
      e.preventDefault()
      e.stopPropagation()
      const rect = canvas.getBoundingClientRect()
      dispatch({
        type: 'zoom',
        delta: e.deltaY,
        mouseX: e.clientX - rect.left,
        mouseY: e.clientY - rect.top
      })
    }

    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height, cursor: 'grab' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    />
  )
}

// Build fleet label like Aurora: "Fleet Name  (Order)  Distance X m  ETA HH:MM:SS  Speed km/s"
function buildFleetLabel(fleet: EnrichedFleet): string {
  const parts: string[] = [fleet.FleetName]

  if (fleet.order) {
    parts.push(` (${fleet.order})`)
  } else if (fleet.ShipCount > 0) {
    parts.push(` [${fleet.ShipCount}]`)
  }

  if (fleet.Speed > 1) {
    if (fleet.distance && fleet.distance > 0) {
      const distM = fleet.distance / 1_000_000
      parts.push(`  Distance ${distM.toFixed(1)} m`)
    }
    if (fleet.eta) {
      parts.push(`  ${fleet.eta}`)
    }
    parts.push(`  ${fleet.Speed} km/s`)
  }

  return parts.join('')
}

// Sort fleets like Aurora: purely alphabetical
function fleetSortComparator(a: { FleetName: string }, b: { FleetName: string }): number {
  return a.FleetName.localeCompare(b.FleetName)
}

function getBodyColor(bodyTypeId: number): string {
  switch (bodyTypeId) {
    // Planets — warm tones stand out against cool CIC palette
    case 2:
      return '#e07840' // Terrestrial
    case 3:
      return '#78909c' // Dwarf Planet
    case 4:
      return '#d4a030' // Gas Giant
    case 5:
      return '#ffa726' // Super-Jovian
    // Moons — subtle cool grays
    case 7:
      return '#546e7a' // Moon - Small
    case 8:
      return '#607d8b' // Moon
    case 9:
      return '#78909c' // Moon large
    case 10:
      return '#90a4ae' // Moon - Terrestrial
    // Other
    case 1:
      return '#455a64' // Asteroid
    case 14:
      return '#00bcd4' // Comet — matches CIC cyan
    default:
      return '#607d8b'
  }
}

function formatScale(scale: number): string {
  if (scale >= 1e6) return `${(scale / 1e6).toFixed(1)}M px/AU`
  if (scale >= 1e3) return `${(scale / 1e3).toFixed(1)}K px/AU`
  return `${scale.toFixed(1)} px/AU`
}
