import React, { useState, useMemo, useEffect } from 'react'
import { SearchPicker, type PickerItem } from './SearchPicker'
import type { ShipClassSummary } from '@renderer/hooks/use-data'

// --- Types ---

export interface SavedRoute {
  id: string
  name: string
  startSystemId: number
  startSystemName: string
  endSystemId: number
  endSystemName: string
  waypoints: { systemId: number; systemName: string; refuel?: boolean }[]
  classId?: number
  className?: string
  createdAt: number
}

// --- Persistence via IPC (file-backed in AppData) ---

async function loadRoutes(): Promise<SavedRoute[]> {
  return window.api.routes.load() as Promise<SavedRoute[]>
}

async function addRoute(route: SavedRoute): Promise<SavedRoute[]> {
  return window.api.routes.add(route) as Promise<SavedRoute[]>
}

async function removeRoute(routeId: string): Promise<SavedRoute[]> {
  return window.api.routes.remove(routeId) as Promise<SavedRoute[]>
}

async function updateRoute(routeId: string, patch: Partial<SavedRoute>): Promise<SavedRoute[]> {
  return window.api.routes.update(routeId, patch) as Promise<SavedRoute[]>
}

// --- Save Dialog ---

export function SaveRouteButton({
  startSystemId,
  startSystemName,
  endSystemId,
  endSystemName,
  waypoints,
  classId,
  className,
  disabled,
  onSaved
}: {
  startSystemId: number
  startSystemName: string
  endSystemId: number
  endSystemName: string
  waypoints: { systemId: number; systemName: string; refuel?: boolean }[]
  classId?: number
  className?: string
  disabled?: boolean
  onSaved?: () => void
}): React.JSX.Element {
  const [showSave, setShowSave] = useState(false)
  const [name, setName] = useState('')

  const handleSave = async (): Promise<void> => {
    if (!name.trim()) return
    const route: SavedRoute = {
      id: `route-${Date.now()}`,
      name: name.trim(),
      startSystemId,
      startSystemName,
      endSystemId,
      endSystemName,
      waypoints,
      classId: classId || undefined,
      className: className || undefined,
      createdAt: Date.now()
    }
    await addRoute(route)
    setName('')
    setShowSave(false)
    onSaved?.()
  }

  if (showSave) {
    return (
      <div className="flex gap-1" style={{ marginTop: 6 }}>
        <input
          type="text"
          placeholder="Route name..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          autoFocus
          className="focus:outline-none"
          style={{
            flex: 1,
            fontSize: 10,
            padding: '4px 8px',
            background: 'var(--cic-panel)',
            border: '1px solid var(--cic-panel-edge)',
            borderRadius: 4,
            color: 'var(--cic-cyan)'
          }}
        />
        <button
          onClick={handleSave}
          className="cursor-pointer"
          style={{
            fontSize: 10,
            padding: '4px 8px',
            borderRadius: 4,
            border: '1px solid var(--cic-cyan)',
            background: 'rgba(0,229,255,0.1)',
            color: 'var(--cic-cyan)'
          }}
        >
          Save
        </button>
        <button
          onClick={() => setShowSave(false)}
          className="cursor-pointer"
          style={{
            fontSize: 10,
            padding: '4px 8px',
            borderRadius: 4,
            border: '1px solid var(--cic-panel-edge)',
            background: 'var(--cic-panel)',
            color: 'var(--cic-cyan-dim)'
          }}
        >
          ×
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setShowSave(true)}
      disabled={disabled}
      className="cursor-pointer"
      style={{
        width: '100%',
        fontSize: 10,
        padding: 6,
        marginTop: 6,
        borderRadius: 4,
        border: '1px solid var(--cic-panel-edge)',
        background: 'var(--cic-panel)',
        color: 'var(--cic-cyan-dim)',
        opacity: disabled ? 0.4 : 1
      }}
    >
      Save Route
    </button>
  )
}

// --- Saved Routes Panel ---

export function SavedRoutesPanel({
  onLoad,
  classes,
  refreshKey
}: {
  onLoad: (route: SavedRoute) => void
  classes: ShipClassSummary[]
  refreshKey?: number
}): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false)
  const [routes, setRoutes] = useState<SavedRoute[]>([])
  const [search, setSearch] = useState('')

  // Load routes on mount and when refreshKey changes
  const [lastKey, setLastKey] = useState(refreshKey)
  useEffect(() => {
    loadRoutes().then(setRoutes)
  }, [])
  if (refreshKey !== lastKey) {
    setLastKey(refreshKey)
    loadRoutes().then(setRoutes)
  }

  const filtered = useMemo(() => {
    if (!search) return routes
    const lower = search.toLowerCase()
    return routes.filter(
      (r) =>
        r.name.toLowerCase().includes(lower) ||
        r.startSystemName.toLowerCase().includes(lower) ||
        r.endSystemName.toLowerCase().includes(lower) ||
        (r.className && r.className.toLowerCase().includes(lower)) ||
        r.waypoints.some((w) => w.systemName.toLowerCase().includes(lower))
    )
  }, [routes, search])

  const handleRemove = async (id: string): Promise<void> => {
    const updated = await removeRoute(id)
    setRoutes(updated)
  }

  const handleAssignClass = async (routeId: string, cid: number, cname: string): Promise<void> => {
    const updated = await updateRoute(routeId, { classId: cid, className: cname })
    setRoutes(updated)
  }

  const handleClearClass = async (routeId: string): Promise<void> => {
    const updated = await updateRoute(routeId, { classId: undefined, className: undefined })
    setRoutes(updated)
  }

  const handleLoad = (route: SavedRoute): void => {
    onLoad(route)
    setIsOpen(false)
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => { loadRoutes().then(setRoutes); setSearch(''); setIsOpen(true) }}
        className="cursor-pointer"
        style={{
          width: '100%',
          fontSize: 10,
          padding: 6,
          marginTop: 4,
          borderRadius: 4,
          border: '1px solid var(--cic-panel-edge)',
          background: 'var(--cic-panel)',
          color: 'var(--cic-cyan-dim)'
        }}
      >
        Saved Routes ({routes.length})
      </button>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={() => setIsOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--cic-deep)',
          border: '1px solid var(--cic-panel-edge)',
          borderRadius: 8,
          width: 520,
          maxHeight: '75vh',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between shrink-0"
          style={{ padding: '8px 12px', borderBottom: '1px solid var(--cic-panel-edge)' }}
        >
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--cic-cyan)' }}>
            Saved Routes
          </span>
          <span style={{ fontSize: 9, color: 'var(--cic-cyan-dim)' }}>
            {search ? `${filtered.length} of ${routes.length}` : `${routes.length} route${routes.length !== 1 ? 's' : ''}`}
          </span>
        </div>

        {/* Search */}
        <div style={{ padding: '6px 12px', borderBottom: '1px solid var(--cic-panel-edge)' }}>
          <input
            type="text"
            placeholder="Search by name, system, class..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
            className="focus:outline-none w-full"
            style={{
              fontSize: 11,
              padding: '4px 8px',
              background: 'var(--cic-panel)',
              border: '1px solid var(--cic-panel-edge)',
              borderRadius: 4,
              color: 'var(--cic-cyan)'
            }}
          />
        </div>

        {/* Route list */}
        <div className="flex-1 overflow-auto" style={{ padding: '4px 0' }}>
          {routes.length === 0 && (
            <div style={{ padding: 20, fontSize: 10, color: 'var(--cic-cyan-dim)', textAlign: 'center' }}>
              No saved routes. Compute a route and click "Save Route".
            </div>
          )}
          {filtered.length === 0 && routes.length > 0 && (
            <div style={{ padding: 20, fontSize: 10, color: 'var(--cic-cyan-dim)', textAlign: 'center' }}>
              No routes match "{search}"
            </div>
          )}
          {filtered.map((route) => (
            <RouteCard
              key={route.id}
              route={route}
              classes={classes}
              onLoad={() => handleLoad(route)}
              onRemove={() => handleRemove(route.id)}
              onAssignClass={(cid, cname) => handleAssignClass(route.id, cid, cname)}
              onClearClass={() => handleClearClass(route.id)}
            />
          ))}
        </div>

        {/* Footer */}
        <div
          className="flex justify-end shrink-0"
          style={{ padding: '6px 12px', borderTop: '1px solid var(--cic-panel-edge)' }}
        >
          <button
            onClick={() => setIsOpen(false)}
            className="cursor-pointer"
            style={{
              fontSize: 10,
              padding: '3px 10px',
              border: '1px solid var(--cic-panel-edge)',
              borderRadius: 4,
              background: 'var(--cic-panel)',
              color: 'var(--cic-cyan-dim)'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// --- Route Card ---

function RouteCard({
  route,
  classes,
  onLoad,
  onRemove,
  onAssignClass,
  onClearClass
}: {
  route: SavedRoute
  classes: ShipClassSummary[]
  onLoad: () => void
  onRemove: () => void
  onAssignClass: (classId: number, className: string) => void
  onClearClass: () => void
}): React.JSX.Element {
  const [showClassPicker, setShowClassPicker] = useState(false)

  const wpSummary = route.waypoints.length > 0
    ? ` via ${route.waypoints.map((w) => w.systemName).join(', ')}`
    : ''

  return (
    <div
      style={{
        padding: '6px 12px',
        borderBottom: '1px solid var(--cic-panel-edge)'
      }}
    >
      {/* Top row: name + actions */}
      <div className="flex items-center justify-between" style={{ marginBottom: 3 }}>
        <span
          onClick={onLoad}
          className="cursor-pointer"
          style={{ fontSize: 11, fontWeight: 600, color: 'var(--cic-cyan)' }}
          onMouseEnter={(e) => ((e.target as HTMLElement).style.textDecoration = 'underline')}
          onMouseLeave={(e) => ((e.target as HTMLElement).style.textDecoration = 'none')}
        >
          {route.name}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={onLoad}
            className="cursor-pointer"
            style={{
              fontSize: 8,
              padding: '1px 5px',
              borderRadius: 3,
              border: '1px solid var(--cic-cyan)',
              background: 'rgba(0,229,255,0.1)',
              color: 'var(--cic-cyan)'
            }}
          >
            Load
          </button>
          <button
            onClick={onRemove}
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

      {/* Route summary */}
      <div style={{ fontSize: 9, color: 'var(--cic-cyan-dim)', marginBottom: 3 }}>
        {route.startSystemName} → {route.endSystemName}{wpSummary}
      </div>

      {/* Class assignment */}
      <div className="flex items-center gap-2" style={{ fontSize: 9 }}>
        {route.className ? (
          <span style={{ color: 'var(--foreground)' }}>
            Class: <span style={{ color: 'var(--cic-cyan)' }}>{route.className}</span>
            <button
              onClick={onClearClass}
              className="cursor-pointer"
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--cic-cyan-dim)',
                marginLeft: 4,
                fontSize: 9
              }}
            >
              ×
            </button>
          </span>
        ) : (
          <>
            {showClassPicker ? (
              <SearchPicker
                title="Assign Ship Class"
                placeholder="Pick class..."
                value={null}
                onSelect={(id) => {
                  const cls = classes.find((c) => c.ShipClassID === Number(id))
                  if (cls) onAssignClass(cls.ShipClassID, cls.ClassName)
                  setShowClassPicker(false)
                }}
                items={classes.map(
                  (c): PickerItem => ({
                    id: c.ShipClassID,
                    label: c.ClassName,
                    sub: `${c.MaxSpeed} km/s · ${c.FuelCapacity.toLocaleString()} L`
                  })
                )}
              />
            ) : (
              <button
                onClick={() => setShowClassPicker(true)}
                className="cursor-pointer"
                style={{
                  fontSize: 8,
                  padding: '1px 5px',
                  borderRadius: 3,
                  border: '1px solid var(--cic-panel-edge)',
                  background: 'var(--cic-panel)',
                  color: 'var(--cic-cyan-dim)'
                }}
              >
                + Assign Class
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
