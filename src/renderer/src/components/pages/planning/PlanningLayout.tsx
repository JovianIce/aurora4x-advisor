import React, { useState } from 'react'
import { FleetTab } from './FleetTab'
import { RoutePlannerTab, type RoutePlannerProps } from './RoutePlannerTab'
import { MineralsTab } from './MineralsTab'
import { ResearchTab } from './ResearchTab'
import type { Ship } from '@renderer/hooks/use-data'

type PlanningView = 'fleet' | 'route' | 'minerals' | 'research'

function TabPane({ visible, children }: { visible: boolean; children: React.ReactNode }): React.JSX.Element {
  return (
    <div
      className="absolute inset-0"
      style={{
        visibility: visible ? 'visible' : 'hidden',
        zIndex: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none'
      }}
    >
      {children}
    </div>
  )
}

const STORAGE_KEY = 'aurora-planning-layout'

function loadState(): { activeTab?: PlanningView } {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}

export function PlanningLayout(): React.JSX.Element {
  const saved = loadState()
  const [activeTab, setActiveTabRaw] = useState<PlanningView>(saved.activeTab || 'fleet')

  const setActiveTab = (tab: PlanningView): void => {
    setActiveTabRaw(tab)
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ activeTab: tab }))
  }
  const [routeProps, setRouteProps] = useState<RoutePlannerProps>({})
  // Increment key to force remount when navigating to route planner with new props
  const [routeKey, setRouteKey] = useState(0)

  const tabs: { key: PlanningView; label: string }[] = [
    { key: 'fleet', label: 'Fleet' },
    { key: 'route', label: 'Route Planner' },
    { key: 'minerals', label: 'Minerals' },
    { key: 'research', label: 'Research' }
  ]

  const handlePlanRoute = (ship: Ship): void => {
    setRouteProps({
      initialClassId: ship.shipClassId,
      initialFromSystem: ship.systemId
    })
    setRouteKey((k) => k + 1)
    setActiveTab('route')
  }

  return (
    <div className="flex flex-col h-full">
      {/* Sub-nav */}
      <div
        className="flex items-center gap-1 px-3 py-1 shrink-0"
        style={{
          borderBottom: '1px solid var(--cic-panel-edge)',
          background: 'var(--cic-deep)'
        }}
      >
        {tabs.map((t) => (
          <button
            key={t.key}
            className="cic-btn"
            style={{
              color: activeTab === t.key ? 'var(--cic-cyan)' : 'var(--cic-cyan-dim)',
              borderBottom: activeTab === t.key ? '2px solid var(--cic-cyan)' : '2px solid transparent',
              fontWeight: activeTab === t.key ? 600 : 400
            }}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content - all tabs stay mounted, hidden tabs pause queries */}
      <div className="flex-1 min-h-0 relative">
        <TabPane visible={activeTab === 'fleet'}>
          <FleetTab active={activeTab === 'fleet'} onPlanRoute={handlePlanRoute} />
        </TabPane>
        <TabPane visible={activeTab === 'route'}>
          <RoutePlannerTab key={routeKey} active={activeTab === 'route'} {...routeProps} />
        </TabPane>
        <TabPane visible={activeTab === 'minerals'}>
          <MineralsTab active={activeTab === 'minerals'} />
        </TabPane>
        <TabPane visible={activeTab === 'research'}>
          <ResearchTab active={activeTab === 'research'} />
        </TabPane>
      </div>
    </div>
  )
}
