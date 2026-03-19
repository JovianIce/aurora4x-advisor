import React from 'react'
import { Outlet } from 'react-router-dom'
import { GameSidebar } from './GameSidebar'

export function RootLayout(): React.JSX.Element {
  return (
    <div className="h-screen overflow-hidden" style={{ background: 'var(--cic-void)' }}>
      <GameSidebar />
      <Outlet />
    </div>
  )
}
