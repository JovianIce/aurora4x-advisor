import React from 'react'

interface SaveGamePromptProps {
  gameName: string
  onSaved: () => void
  onBack: () => void
}

export function SaveGamePrompt({
  gameName,
  onSaved,
  onBack
}: SaveGamePromptProps): React.JSX.Element {
  return (
    <div className="h-full flex items-center justify-center p-8">
      <div className="w-full max-w-md cic-stagger">
        <div className="cic-label mb-4" style={{ color: 'var(--cic-cyan)', fontSize: '10px' }}>
          Step 2 — Synchronize with Aurora
        </div>

        <div className="cic-panel p-4 space-y-4">
          <div
            className="space-y-3 cic-data"
            style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', lineHeight: '1.6' }}
          >
            <div className="flex gap-3">
              <span style={{ color: 'var(--cic-amber)', minWidth: '16px' }}>1.</span>
              <span>Switch to Aurora 4X</span>
            </div>
            <div className="flex gap-3">
              <span style={{ color: 'var(--cic-amber)', minWidth: '16px' }}>2.</span>
              <div>
                <span>Save your game with this exact designation:</span>
                <div
                  className="mt-2 px-3 py-2"
                  style={{
                    background: 'var(--cic-void)',
                    border: '1px solid var(--cic-cyan-dim)',
                    color: 'var(--cic-cyan)',
                    fontFamily: 'Consolas, SF Mono, Monaco, monospace',
                    fontSize: '12px',
                    letterSpacing: '0.05em'
                  }}
                >
                  {gameName}
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <span style={{ color: 'var(--cic-amber)', minWidth: '16px' }}>3.</span>
              <span>Return here and confirm</span>
            </div>
          </div>

          <div
            className="p-2"
            style={{
              background: 'rgba(255, 179, 0, 0.04)',
              borderLeft: '2px solid var(--cic-amber-dim)'
            }}
          >
            <span className="cic-data" style={{ color: 'var(--cic-amber-dim)', fontSize: '9px' }}>
              Name must match exactly — case-sensitive
            </span>
          </div>

          <div
            className="flex justify-between pt-1"
            style={{ borderTop: '1px solid var(--cic-panel-edge)' }}
          >
            <button className="cic-btn" onClick={onBack}>
              ← Back
            </button>
            <button className="cic-btn cic-btn-amber" onClick={onSaved}>
              Game Saved — Scan →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
