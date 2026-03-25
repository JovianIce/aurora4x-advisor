import React, { useState } from 'react'
import { useSettings } from '@renderer/hooks/use-settings'

// Solaris theme icons (black silhouettes — colorized via CSS mask-image)
import iconAutoOn from '@renderer/assets/icons/solaris/AutoTurnsOn.png'
import iconAutoOff from '@renderer/assets/icons/solaris/AutoTurnsOff.png'
import iconColony from '@renderer/assets/icons/solaris/Colony.png'
import iconIndustry from '@renderer/assets/icons/solaris/Industry.png'
import iconMining from '@renderer/assets/icons/solaris/Mining.png'
import iconResearch from '@renderer/assets/icons/solaris/Research.png'
import iconWealth from '@renderer/assets/icons/solaris/Wealth.png'
import iconFleet from '@renderer/assets/icons/solaris/Fleet.png'
import iconCommanders from '@renderer/assets/icons/solaris/Commanders.png'
import iconGroundForces from '@renderer/assets/icons/solaris/GroundForces.png'
import iconMedals from '@renderer/assets/icons/solaris/Medals.png'
import iconClass from '@renderer/assets/icons/solaris/Class.png'
import iconProject from '@renderer/assets/icons/solaris/Project.png'
import iconMissileDesign from '@renderer/assets/icons/solaris/MissileDesign.png'
import iconTurret from '@renderer/assets/icons/solaris/Turrent.png'
import iconSystem from '@renderer/assets/icons/solaris/System.png'
import iconGalactic from '@renderer/assets/icons/solaris/Galactic.png'
import iconRace from '@renderer/assets/icons/solaris/Race.png'
import iconIntelligence from '@renderer/assets/icons/solaris/Intelligence.png'
import iconTechnology from '@renderer/assets/icons/solaris/Technology.png'
import iconSurvey from '@renderer/assets/icons/solaris/Survey.png'
import iconComparison from '@renderer/assets/icons/solaris/Comparison.png'
import iconEvents from '@renderer/assets/icons/solaris/Events.png'
import iconSector from '@renderer/assets/icons/solaris/Sector.png'
import iconGame from '@renderer/assets/icons/solaris/Game.png'
import iconSave from '@renderer/assets/icons/solaris/Save.png'

// Solaris color scheme (from SolarisTheme C# source)
const ICON_COLOR = 'rgb(210, 210, 210)' // mainTextColor
const AUTO_ON_COLOR = 'rgb(126, 211, 33)' // enabledAutoTurnsButtonColor

// Button background colors per Solaris category
const BG_ECONOMICS = 'rgb(26, 45, 46)'
const BG_DESIGN = 'rgb(41, 44, 46)'
const BG_FLEET = 'rgb(45, 26, 26)'
const BG_GROUND = 'rgb(42, 45, 28)'
const BG_INTELLIGENCE = 'rgb(47, 38, 47)'
const BG_EXPLORATION = 'rgb(24, 27, 78)'
const BG_PERSONNEL = 'rgb(18, 41, 58)'
const BG_SURVEY = 'rgb(40, 31, 24)'
const BG_TECHNOLOGY = 'rgb(42, 22, 45)'
const BG_SECTOR = 'rgb(20, 45, 31)'

interface ToolbarButton {
  label: string
  target: string // AuroraButton enum name
  group: 'time' | 'management' | 'military' | 'design' | 'info' | 'util'
  icon: string
  bgColor?: string // Solaris button background color
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
  // Economics
  {
    label: 'Colony',
    target: 'ToolbarColony',
    group: 'management',
    icon: iconColony,
    bgColor: BG_ECONOMICS
  },
  {
    label: 'Industry',
    target: 'ToolbarIndustry',
    group: 'management',
    icon: iconIndustry,
    bgColor: BG_ECONOMICS
  },
  {
    label: 'Mining',
    target: 'ToolbarMining',
    group: 'management',
    icon: iconMining,
    bgColor: BG_ECONOMICS
  },
  {
    label: 'Research',
    target: 'ToolbarResearch',
    group: 'management',
    icon: iconResearch,
    bgColor: BG_ECONOMICS
  },
  {
    label: 'Wealth',
    target: 'ToolbarWealth',
    group: 'management',
    icon: iconWealth,
    bgColor: BG_ECONOMICS
  },
  // Military
  { label: 'Fleet', target: 'ToolbarFleet', group: 'military', icon: iconFleet, bgColor: BG_FLEET },
  {
    label: 'Commanders',
    target: 'ToolbarCommanders',
    group: 'military',
    icon: iconCommanders,
    bgColor: BG_PERSONNEL
  },
  {
    label: 'Ground',
    target: 'ToolbarGroundForces',
    group: 'military',
    icon: iconGroundForces,
    bgColor: BG_GROUND
  },
  {
    label: 'Medals',
    target: 'ToolbarMedals',
    group: 'military',
    icon: iconMedals,
    bgColor: BG_PERSONNEL
  },
  // Design
  { label: 'Class', target: 'ToolbarClass', group: 'design', icon: iconClass, bgColor: BG_DESIGN },
  {
    label: 'Project',
    target: 'ToolbarProject',
    group: 'design',
    icon: iconProject,
    bgColor: BG_DESIGN
  },
  {
    label: 'Missile',
    target: 'ToolbarMissileDesign',
    group: 'design',
    icon: iconMissileDesign,
    bgColor: BG_DESIGN
  },
  {
    label: 'Turret',
    target: 'ToolbarTurrent',
    group: 'design',
    icon: iconTurret,
    bgColor: BG_DESIGN
  },
  // Info
  {
    label: 'System',
    target: 'ToolbarSystem',
    group: 'info',
    icon: iconSystem,
    bgColor: BG_EXPLORATION
  },
  {
    label: 'Galactic',
    target: 'ToolbarGalactic',
    group: 'info',
    icon: iconGalactic,
    bgColor: BG_EXPLORATION
  },
  { label: 'Race', target: 'ToolbarRace', group: 'info', icon: iconRace, bgColor: BG_INTELLIGENCE },
  {
    label: 'Intel',
    target: 'ToolbarIntelligence',
    group: 'info',
    icon: iconIntelligence,
    bgColor: BG_INTELLIGENCE
  },
  {
    label: 'Tech',
    target: 'ToolbarTechnology',
    group: 'info',
    icon: iconTechnology,
    bgColor: BG_TECHNOLOGY
  },
  { label: 'Survey', target: 'ToolbarSurvey', group: 'info', icon: iconSurvey, bgColor: BG_SURVEY },
  {
    label: 'Compare',
    target: 'ToolbarComparison',
    group: 'info',
    icon: iconComparison,
    bgColor: BG_INTELLIGENCE
  },
  // Utility
  { label: 'Events', target: 'ToolbarEvents', group: 'util', icon: iconEvents },
  {
    label: 'Sectors',
    target: 'ToolbarSector',
    group: 'util',
    icon: iconSector,
    bgColor: BG_SECTOR
  },
  { label: 'Game', target: 'ToolbarGame', group: 'util', icon: iconGame },
  { label: 'Save', target: 'ToolbarSave', group: 'util', icon: iconSave }
]

/** Renders a colorized icon using CSS mask-image (icon silhouette filled with the given color) */
function SolarisIcon({
  src,
  color,
  size = 30
}: {
  src: string
  color: string
  size?: number
}): React.JSX.Element {
  return (
    <span
      style={{
        display: 'block',
        width: size,
        height: size,
        backgroundColor: color,
        WebkitMaskImage: `url(${src})`,
        maskImage: `url(${src})`,
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center'
      }}
    />
  )
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
        height: '16px',
        background: 'var(--cic-panel-edge)',
        margin: '0 3px',
        flexShrink: 0
      }}
    />
  )

  return (
    <div
      className="flex items-center gap-0.5 px-3 py-0.5 shrink-0 overflow-x-auto"
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
              padding: '4px 6px',
              whiteSpace: 'nowrap',
              boxShadow: autoOn ? '0 0 8px rgba(126, 211, 33, 0.3)' : 'none',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onClick={toggleAuto}
            title={autoOn ? 'Stop auto-increment' : 'Start auto-increment'}
          >
            <SolarisIcon
              src={autoOn ? iconAutoOn : iconAutoOff}
              color={autoOn ? AUTO_ON_COLOR : ICON_COLOR}
            />
          </button>
          <button
            className={`cic-btn ${showTime ? 'active' : ''}`}
            style={{ fontSize: '9px', padding: '2px 6px', whiteSpace: 'nowrap' }}
            onClick={() => setShowTime(!showTime)}
            title="Set time increment"
          >
            Time {showTime ? '\u25BE' : '\u25B8'}
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
                padding: '4px 5px',
                whiteSpace: 'nowrap',
                opacity: busy === btn.target ? 0.5 : 1,
                backgroundColor: btn.bgColor,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              onClick={() => clickButton(btn.target)}
              disabled={busy !== null}
              title={`Open ${btn.label} window`}
            >
              <SolarisIcon src={btn.icon} color={ICON_COLOR} />
            </button>
          </React.Fragment>
        )
      })}
    </div>
  )
}
