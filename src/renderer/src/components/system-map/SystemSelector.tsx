import React from 'react'
import { useRealtimeSystems } from '@renderer/hooks/use-realtime'

interface SystemSelectorProps {
  value: number | null
  onChange: (systemId: number) => void
  gameId: number | null
}

export function SystemSelector({
  value,
  onChange,
  gameId
}: SystemSelectorProps): React.JSX.Element {
  const { data: systems, isLoading } = useRealtimeSystems()

  if (!gameId) {
    return <span className="cic-label">No game linked</span>
  }

  return (
    <select
      value={value?.toString() ?? ''}
      onChange={(e) => e.target.value && onChange(Number(e.target.value))}
      disabled={isLoading || !systems?.length}
      className="cic-data"
      style={{
        background: 'var(--cic-panel)',
        border: '1px solid var(--cic-panel-edge)',
        borderRadius: '2px',
        color: value ? 'var(--cic-cyan)' : 'var(--cic-cyan-dim)',
        padding: '4px 8px',
        fontSize: '11px',
        minWidth: '160px',
        cursor: 'pointer',
        outline: 'none'
      }}
    >
      <option value="">{isLoading ? 'Loading...' : '— Select System —'}</option>
      {systems
        ?.sort((a, b) => a.Name.localeCompare(b.Name))
        .map((sys) => (
          <option key={sys.SystemID} value={sys.SystemID.toString()}>
            {sys.Name}
          </option>
        ))}
    </select>
  )
}
