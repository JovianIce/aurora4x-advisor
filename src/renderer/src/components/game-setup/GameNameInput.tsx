import React, { useState } from 'react'

interface GameNameInputProps {
  onNext: (gameName: string) => void
  onBack: () => void
}

export function GameNameInput({ onNext, onBack }: GameNameInputProps): React.JSX.Element {
  const [gameName, setGameName] = useState('')

  const handleNext = (): void => {
    if (gameName.trim()) {
      onNext(gameName.trim())
    }
  }

  return (
    <div className="h-full flex items-center justify-center p-8">
      <div className="w-full max-w-md cic-stagger">
        <div className="cic-label mb-4" style={{ color: 'var(--cic-cyan)', fontSize: '10px' }}>
          Step 1 — Campaign Designation
        </div>

        <div className="cic-panel p-4 space-y-4">
          <div>
            <label className="cic-label block mb-2" style={{ fontSize: '9px' }} htmlFor="gameName">
              Game Name
            </label>
            <input
              id="gameName"
              type="text"
              placeholder="Enter exact Aurora game name..."
              value={gameName}
              onChange={(e) => setGameName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleNext()
              }}
              autoFocus
              className="w-full px-3 py-2 cic-data"
              style={{
                background: 'var(--cic-void)',
                border: '1px solid var(--cic-panel-edge)',
                color: 'var(--cic-cyan)',
                fontSize: '12px',
                outline: 'none'
              }}
            />
          </div>

          <p
            className="cic-data"
            style={{ color: 'rgba(255,255,255,0.3)', fontSize: '9px', lineHeight: '1.5' }}
          >
            Must match exactly with the name in Aurora 4X (case-sensitive).
          </p>

          <div
            className="flex justify-between pt-1"
            style={{ borderTop: '1px solid var(--cic-panel-edge)' }}
          >
            <button className="cic-btn" onClick={onBack}>
              ← Back
            </button>
            <button
              className="cic-btn cic-btn-amber"
              onClick={handleNext}
              disabled={!gameName.trim()}
              style={{ opacity: gameName.trim() ? 1 : 0.3 }}
            >
              Proceed →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
