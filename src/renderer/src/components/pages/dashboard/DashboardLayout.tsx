import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGame } from '@renderer/hooks/use-game'
import { SystemMapTab } from './SystemMapTab'
import { TableExplorerTab } from './TableExplorerTab'
import { DashboardOverview } from './DashboardOverview'
import { BridgeStatusIndicator } from '../../system-map/BridgeStatusIndicator'

export function DashboardLayout(): React.JSX.Element {
  const navigate = useNavigate()
  const { currentGame } = useGame()
  const [activeView, setActiveView] = useState<'map' | 'tables' | 'advisor'>('map')

  useEffect(() => {
    if (!currentGame) {
      navigate('/')
    }
  }, [currentGame, navigate])

  if (!currentGame) {
    return <div />
  }

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: 'var(--cic-void)' }}>
      {/* Top Command Bar */}
      <div
        className="flex items-center justify-between px-3 py-1 flex-shrink-0"
        style={{
          background: 'linear-gradient(180deg, var(--cic-panel) 0%, var(--cic-deep) 100%)',
          borderBottom: '1px solid var(--cic-panel-edge)'
        }}
      >
        {/* Left: Game info — padded left for sidebar trigger button */}
        <div className="flex items-center gap-4" style={{ marginLeft: '130px' }}>
          <div className="flex items-center gap-2">
            <div
              className="cic-label"
              style={{ color: 'var(--cic-amber)', letterSpacing: '0.2em', fontSize: '10px' }}
            >
              AURORA CIC
            </div>
            <div
              style={{
                width: '1px',
                height: '14px',
                background: 'var(--cic-panel-edge)'
              }}
            />
            <span className="cic-data" style={{ color: 'var(--cic-cyan-dim)' }}>
              {currentGame.gameInfo.empireName}
            </span>
          </div>
        </div>

        {/* Center: View toggles */}
        <div className="flex items-center gap-1">
          <button
            className={`cic-btn ${activeView === 'map' ? 'active' : ''}`}
            onClick={() => setActiveView('map')}
          >
            Tactical Map
          </button>
          <button
            className={`cic-btn ${activeView === 'tables' ? 'active' : ''}`}
            onClick={() => setActiveView('tables')}
          >
            Data Core
          </button>
          <button
            className={`cic-btn ${activeView === 'advisor' ? 'active' : ''}`}
            onClick={() => setActiveView('advisor')}
          >
            Advisor
          </button>
        </div>

        {/* Right: Status */}
        <div className="flex items-center gap-4">
          <BridgeStatusIndicator />
          <button
            className="cic-btn"
            onClick={() => navigate('/settings')}
          >
            Config
          </button>
        </div>
      </div>

      {/* Main Content — full remaining height */}
      <div className="flex-1 min-h-0">
        {activeView === 'map' ? (
          <SystemMapTab game={currentGame} />
        ) : activeView === 'advisor' ? (
          <div className="p-4 h-full overflow-auto">
            <DashboardOverview />
          </div>
        ) : (
          <div className="p-4 h-full overflow-auto">
            <TableExplorerTab />
          </div>
        )}
      </div>
    </div>
  )
}
