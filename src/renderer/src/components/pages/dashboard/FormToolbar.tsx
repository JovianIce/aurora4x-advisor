import React, { useState } from 'react'
import { useSettings } from '@renderer/hooks/use-settings'

interface ToolbarButton {
  label: string
  target: string // AuroraButton enum name
  group: 'time' | 'management' | 'military' | 'design' | 'info' | 'util'
}

const TIME_INCREMENTS: { label: string; target: string }[] = [
  { label: '5s', target: 'Increment5S' },
  { label: '30s', target: 'Increment30S' },
  { label: '2m', target: 'Increment2M' },
  { label: '5m', target: 'Increment5M' },
  { label: '20m', target: 'Increment20M' },
  { label: '1h', target: 'Increment1H' },
  { label: '3h', target: 'Increment3H' },
  { label: '8h', target: 'Increment8H' },
  { label: '1d', target: 'Increment1D' },
  { label: '5d', target: 'Increment5D' },
  { label: '30d', target: 'Increment30D' }
]

const FORM_BUTTONS: ToolbarButton[] = [
  // Management
  { label: 'Colony', target: 'ToolbarColony', group: 'management' },
  { label: 'Industry', target: 'ToolbarIndustry', group: 'management' },
  { label: 'Mining', target: 'ToolbarMining', group: 'management' },
  { label: 'Research', target: 'ToolbarResearch', group: 'management' },
  { label: 'Wealth', target: 'ToolbarWealth', group: 'management' },
  // Military
  { label: 'Fleet', target: 'ToolbarFleet', group: 'military' },
  { label: 'Commanders', target: 'ToolbarCommanders', group: 'military' },
  { label: 'Ground', target: 'ToolbarGroundForces', group: 'military' },
  { label: 'Medals', target: 'ToolbarMedals', group: 'military' },
  // Design
  { label: 'Class', target: 'ToolbarClass', group: 'design' },
  { label: 'Project', target: 'ToolbarProject', group: 'design' },
  { label: 'Missile', target: 'ToolbarMissileDesign', group: 'design' },
  { label: 'Turret', target: 'ToolbarTurrent', group: 'design' },
  // Info
  { label: 'System', target: 'ToolbarSystem', group: 'info' },
  { label: 'Galactic', target: 'ToolbarGalactic', group: 'info' },
  { label: 'Race', target: 'ToolbarRace', group: 'info' },
  { label: 'Intel', target: 'ToolbarIntelligence', group: 'info' },
  { label: 'Tech', target: 'ToolbarTechnology', group: 'info' },
  { label: 'Survey', target: 'ToolbarSurvey', group: 'info' },
  { label: 'Compare', target: 'ToolbarComparison', group: 'info' },
  // Utility
  { label: 'Events', target: 'ToolbarEvents', group: 'util' },
  { label: 'Sectors', target: 'ToolbarSector', group: 'util' },
  { label: 'Game', target: 'ToolbarGame', group: 'util' },
  { label: 'Save', target: 'ToolbarSave', group: 'util' }
]

const GROUP_COLORS: Record<string, string> = {
  management: 'var(--cic-cyan-dim)',
  military: 'var(--cic-green)',
  design: 'var(--cic-amber-dim)',
  info: 'var(--cic-cyan-dim)',
  util: 'rgba(255,255,255,0.4)'
}

export function FormToolbar(): React.JSX.Element {
  const { settings } = useSettings()
  const [busy, setBusy] = useState<string | null>(null)
  const [autoOn, setAutoOn] = useState(false)
  const [showTime, setShowTime] = useState(false)

  const clickButton = async (target: string): Promise<void> => {
    if (busy) return
    setBusy(target)
    try {
      await window.api.bridge.executeAction({
        Action: 'ClickButton',
        Target: target
      })
    } catch (err) {
      console.error(`Failed: ${target}`, err)
    } finally {
      setBusy(null)
    }
  }

  const toggleAuto = async (): Promise<void> => {
    try {
      await window.api.bridge.executeAction({
        Action: 'ClickButton',
        Target: 'ToolbarAuto'
      })
      setAutoOn((prev) => !prev)
    } catch (err) {
      console.error('Failed to toggle auto:', err)
    }
  }

  const sep = (
    <div
      style={{
        width: '1px',
        height: '14px',
        background: 'var(--cic-panel-edge)',
        margin: '0 3px',
        flexShrink: 0
      }}
    />
  )

  return (
    <div
      className="flex items-center gap-0.5 px-3 py-0.5 flex-shrink-0 overflow-x-auto"
      style={{
        background: 'var(--cic-deep)',
        borderBottom: '1px solid var(--cic-panel-edge)'
      }}
    >
      {settings?.enableTimeControls && (
        <>
          <button
            className={`cic-btn ${autoOn ? 'active' : ''}`}
            style={{
              fontSize: '10px',
              padding: '2px 10px',
              fontWeight: 'bold',
              color: autoOn ? 'var(--cic-green)' : 'var(--cic-red)',
              whiteSpace: 'nowrap',
              boxShadow: autoOn ? '0 0 8px rgba(0, 230, 118, 0.3)' : 'none'
            }}
            onClick={toggleAuto}
            title={autoOn ? 'Stop auto-increment' : 'Start auto-increment'}
          >
            {autoOn ? 'STOP' : 'AUTO'}
          </button>
          <button
            className={`cic-btn ${showTime ? 'active' : ''}`}
            style={{ fontSize: '9px', padding: '2px 6px', whiteSpace: 'nowrap' }}
            onClick={() => setShowTime(!showTime)}
            title="Set time increment"
          >
            Time {showTime ? '▾' : '▸'}
          </button>
          {showTime &&
            TIME_INCREMENTS.map((t) => (
              <button
                key={t.target}
                className="cic-btn"
                style={{
                  fontSize: '9px',
                  padding: '2px 5px',
                  color: busy === t.target ? 'var(--cic-amber)' : 'rgba(255,255,255,0.5)',
                  whiteSpace: 'nowrap'
                }}
                onClick={() => clickButton(t.target)}
                disabled={busy !== null}
                title={`Set increment to ${t.label}`}
              >
                {t.label}
              </button>
            ))}
          {sep}
        </>
      )}

      {/* Form buttons — these open visible Aurora forms, acting as toolbar shortcuts */}
      {FORM_BUTTONS.map((btn, i) => {
        const prevGroup = i > 0 ? FORM_BUTTONS[i - 1].group : null
        const showSep = prevGroup && prevGroup !== btn.group

        return (
          <React.Fragment key={btn.target}>
            {showSep && sep}
            <button
              className="cic-btn"
              style={{
                fontSize: '9px',
                padding: '2px 6px',
                color: busy === btn.target ? 'var(--cic-amber)' : GROUP_COLORS[btn.group],
                whiteSpace: 'nowrap'
              }}
              onClick={() => clickButton(btn.target)}
              disabled={busy !== null}
              title={`Open ${btn.label} window`}
            >
              {busy === btn.target ? '...' : btn.label}
            </button>
          </React.Fragment>
        )
      })}
    </div>
  )
}
