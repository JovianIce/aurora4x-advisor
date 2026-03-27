/**
 * Shared UI primitives for Operations pages.
 * Uses CIC theme variables (--cic-*) from the advisor app.
 */

import { type ReactNode, useState } from 'react'

// --- Fuel Bar ---

export function FuelBar({ pct }: { pct: number | null }): React.JSX.Element {
  if (pct == null) return <span style={{ fontSize: 8, color: 'var(--cic-cyan-dim)' }}>—</span>
  const color = pct > 60 ? 'var(--cic-green)' : pct > 25 ? 'var(--cic-amber)' : 'var(--cic-red)'
  return (
    <div className="flex items-center gap-1">
      <div
        style={{
          width: 40,
          height: 4,
          background: 'var(--cic-panel-edge)',
          borderRadius: 999,
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            borderRadius: 999,
            background: color,
            transition: 'width 0.3s'
          }}
        />
      </div>
      <span style={{ fontSize: 8 }}>{pct}%</span>
    </div>
  )
}

// --- Dual Fuel Bar (start → end) ---

export function DualFuelBar({
  startPct,
  endPct,
  insufficient
}: {
  startPct: number
  endPct: number
  insufficient: boolean
}): React.JSX.Element {
  const endColor = insufficient
    ? 'var(--cic-red)'
    : endPct > 60
      ? 'var(--cic-green)'
      : endPct > 25
        ? 'var(--cic-amber)'
        : 'var(--cic-red)'
  const ghostColor = insufficient ? 'rgba(255,23,68,0.15)' : 'rgba(0,229,255,0.15)'

  return (
    <div className="flex items-center gap-1.5">
      <div
        style={{
          width: 60,
          height: 6,
          background: 'var(--cic-panel-edge)',
          borderRadius: 999,
          overflow: 'hidden',
          position: 'relative'
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            height: '100%',
            width: `${startPct}%`,
            borderRadius: 999,
            background: ghostColor
          }}
        />
        <div
          style={{
            position: 'relative',
            height: '100%',
            width: `${Math.max(0, endPct)}%`,
            borderRadius: 999,
            background: endColor,
            transition: 'width 0.3s'
          }}
        />
      </div>
      <span style={{ fontSize: 10 }}>{endPct}%</span>
    </div>
  )
}

// --- Info Card ---

export function InfoCard({
  label,
  value,
  sub,
  warn,
  crit,
  onClick
}: {
  label: string
  value: string
  sub?: string
  warn?: boolean
  crit?: boolean
  onClick?: () => void
}): React.JSX.Element {
  const valueColor = crit ? 'var(--cic-red)' : warn ? 'var(--cic-amber)' : 'inherit'
  return (
    <div
      onClick={onClick}
      className={onClick ? 'hover:border-[var(--cic-cyan)]' : ''}
      style={{
        background: 'var(--cic-panel)',
        border: '1px solid var(--cic-panel-edge)',
        borderRadius: 4,
        padding: '8px 10px',
        cursor: onClick ? 'pointer' : undefined,
        transition: 'border-color 0.15s'
      }}
    >
      <div
        style={{
          fontSize: 9,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--cic-cyan-dim)',
          marginBottom: 2
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: valueColor }}>{value}</div>
      {sub && <div style={{ fontSize: 9, color: 'var(--cic-cyan-dim)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

// --- Section Header ---

export function SectionHeader({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <div
      style={{
        fontSize: 9,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        color: 'var(--cic-cyan-dim)',
        marginBottom: 4,
        marginTop: 8
      }}
    >
      {children}
    </div>
  )
}

// --- Ship Tag (DB-driven) ---

interface ShipFlags {
  military?: boolean
  commercial?: boolean
  fighter?: boolean
  tanker?: boolean
  freighter?: boolean
}

const TAG_STYLES: Record<string, { label: string; bg: string; color: string }> = {
  tanker: { label: 'Tanker', bg: 'rgba(255,179,0,0.15)', color: 'var(--cic-amber)' },
  freighter: { label: 'Freighter', bg: 'rgba(0,229,255,0.15)', color: 'var(--cic-cyan)' },
  fighter: { label: 'Fighter', bg: 'rgba(255,23,68,0.15)', color: 'var(--cic-red)' },
  military: { label: 'Military', bg: 'rgba(255,23,68,0.15)', color: 'var(--cic-red)' },
  commercial: { label: 'Commercial', bg: 'rgba(139,148,158,0.15)', color: 'var(--cic-cyan-dim)' }
}

export function ShipTag({ ship }: { ship: ShipFlags }): React.JSX.Element | null {
  let type = ''
  if (ship.tanker) type = 'tanker'
  else if (ship.freighter) type = 'freighter'
  else if (ship.fighter) type = 'fighter'
  else if (ship.military) type = 'military'
  else if (ship.commercial) type = 'commercial'
  const tag = TAG_STYLES[type]
  if (!tag) return null
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: 9,
        padding: '1px 4px',
        borderRadius: 8,
        marginLeft: 4,
        background: tag.bg,
        color: tag.color
      }}
    >
      {tag.label}
    </span>
  )
}

// --- Action Button ---

export function ActionButton({
  label,
  onClick
}: {
  label: string
  onClick?: () => void
}): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      className="cursor-pointer hover:border-[var(--cic-cyan)] hover:text-[var(--cic-cyan)]"
      style={{
        padding: '4px 8px',
        fontSize: 10,
        borderRadius: 4,
        border: '1px solid var(--cic-panel-edge)',
        background: 'var(--cic-panel)',
        color: 'var(--cic-cyan-dim)',
        transition: 'border-color 0.15s, color 0.15s'
      }}
    >
      {label}
    </button>
  )
}

// --- Tooltip ---

export function Tooltip({
  text,
  children
}: {
  text: string
  children: ReactNode
}): React.JSX.Element {
  const [show, setShow] = useState(false)
  const [pos, setPos] = useState({ x: 0, y: 0 })

  return (
    <span
      className="relative inline-block"
      onMouseEnter={(e) => {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
        // Clamp x so tooltip doesn't overflow viewport edges
        const x = Math.max(100, Math.min(rect.left + rect.width / 2, window.innerWidth - 100))
        setPos({ x, y: rect.top })
        setShow(true)
      }}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <span
          style={{
            position: 'fixed',
            left: pos.x,
            top: pos.y - 4,
            transform: 'translate(-50%, -100%)',
            padding: '3px 8px',
            fontSize: 9,
            borderRadius: 4,
            background: 'var(--cic-panel)',
            border: '1px solid var(--cic-panel-edge)',
            color: 'var(--cic-cyan-dim)',
            whiteSpace: 'nowrap',
            zIndex: 100,
            pointerEvents: 'none'
          }}
        >
          {text}
        </span>
      )}
    </span>
  )
}
