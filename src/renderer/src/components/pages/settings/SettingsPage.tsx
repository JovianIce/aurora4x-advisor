import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useGame } from '@renderer/hooks/use-game'
import { toast } from 'sonner'

export function SettingsPage(): React.JSX.Element {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { currentGame } = useGame()

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => window.api.settings.load()
  })

  const { data: watcherStatus } = useQuery({
    queryKey: ['dbWatcher', 'status'],
    queryFn: () => window.api.dbWatcher.getStatus(),
    refetchInterval: 2000
  })

  const pickFileMutation = useMutation({
    mutationFn: async () => {
      const filePath = await window.api.dbWatcher.pickFile()
      if (!filePath) throw new Error('No file selected')
      return filePath
    },
    onSuccess: async (filePath) => {
      await window.api.dbWatcher.setPath(filePath)
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      queryClient.invalidateQueries({ queryKey: ['dbWatcher', 'status'] })
      toast.success('Database path updated', {
        description: 'File watcher is now monitoring your database'
      })
    },
    onError: (error) => {
      if (error.message !== 'No file selected') {
        toast.error('Failed to set database path')
      }
    }
  })

  const clearPathMutation = useMutation({
    mutationFn: async () => {
      await window.api.dbWatcher.setPath(null)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      queryClient.invalidateQueries({ queryKey: ['dbWatcher', 'status'] })
      toast.success('Database path cleared')
    }
  })

  const handleBack = (): void => {
    if (currentGame) {
      navigate('/dashboard')
    } else {
      navigate('/')
    }
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <span
          className="cic-data cic-glow"
          style={{ color: 'var(--cic-cyan-dim)', fontSize: '10px' }}
        >
          Loading configuration...
        </span>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      {/* Header bar */}
      <div
        className="flex items-center gap-3 px-4 py-2 sticky top-0 z-10"
        style={{
          background: 'var(--cic-panel)',
          borderBottom: '1px solid var(--cic-panel-edge)'
        }}
      >
        <button className="cic-btn" onClick={handleBack}>
          ← Back
        </button>
        <span
          className="cic-label"
          style={{ color: 'var(--cic-amber)', letterSpacing: '0.2em', fontSize: '10px' }}
        >
          System Configuration
        </span>
      </div>

      <div className="p-6 max-w-3xl mx-auto space-y-4 cic-stagger">
        {/* Aurora Database */}
        <div className="cic-panel">
          <div className="cic-panel-header">Aurora Database</div>
          <div className="p-4 space-y-4">
            {/* Current Path */}
            <div>
              <div className="cic-label mb-2" style={{ fontSize: '9px' }}>
                Database Path
              </div>
              <div
                className="px-3 py-2 cic-data break-all"
                style={{
                  background: 'var(--cic-void)',
                  border: '1px solid var(--cic-panel-edge)',
                  color: settings?.auroraDbPath ? 'var(--cic-cyan-dim)' : 'rgba(255,255,255,0.2)',
                  fontSize: '10px'
                }}
              >
                {settings?.auroraDbPath || 'No database path configured'}
              </div>
            </div>

            {/* Status */}
            <div className="flex items-center gap-2">
              <span className="cic-label" style={{ fontSize: '9px' }}>
                Status:
              </span>
              <div
                className={`cic-status-dot ${watcherStatus?.isWatching ? 'online' : 'offline'}`}
              />
              <span
                className="cic-data"
                style={{
                  color: watcherStatus?.isWatching ? 'var(--cic-green)' : 'rgba(255,255,255,0.3)',
                  fontSize: '10px'
                }}
              >
                {watcherStatus?.isWatching ? 'Watching' : 'Not watching'}
              </span>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                className="cic-btn cic-btn-amber"
                onClick={() => pickFileMutation.mutate()}
                disabled={pickFileMutation.isPending}
              >
                {pickFileMutation.isPending ? 'Selecting...' : 'Select Database File'}
              </button>
              {settings?.auroraDbPath && (
                <button
                  className="cic-btn"
                  onClick={() => clearPathMutation.mutate()}
                  disabled={clearPathMutation.isPending}
                >
                  Clear Path
                </button>
              )}
            </div>

            {/* Help */}
            <div
              className="cic-data space-y-1 pt-2"
              style={{
                color: 'rgba(255,255,255,0.3)',
                fontSize: '9px',
                lineHeight: '1.5',
                borderTop: '1px solid var(--cic-panel-edge)'
              }}
            >
              <p style={{ color: 'var(--cic-amber-dim)' }}>Locating your database:</p>
              <p>— Check your Aurora 4X installation folder</p>
              <p>— The file is named &quot;AuroraDB.db&quot;</p>
              <p>— The advisor watches this file and creates snapshots on changes</p>
            </div>
          </div>
        </div>

        {/* How it works */}
        <div className="cic-panel">
          <div className="cic-panel-header">Snapshot System</div>
          <div className="p-4 space-y-3">
            <div
              className="p-2"
              style={{
                background: 'rgba(255, 179, 0, 0.04)',
                borderLeft: '2px solid var(--cic-amber-dim)'
              }}
            >
              <span
                className="cic-data"
                style={{ color: 'var(--cic-amber-dim)', fontSize: '9px', lineHeight: '1.5' }}
              >
                Ensure the correct campaign is selected in Fleet Command before saving in Aurora.
                Snapshots are filed under the active campaign.
              </span>
            </div>

            <div
              className="cic-data space-y-2"
              style={{ color: 'rgba(255,255,255,0.4)', fontSize: '9px', lineHeight: '1.5' }}
            >
              <p>
                When you save in Aurora 4X, the advisor automatically snapshots your database.
                Snapshots are organized by campaign name and in-game year.
              </p>
              <p>
                Storage:{' '}
                <span
                  style={{
                    color: 'var(--cic-cyan-dim)',
                    fontFamily: 'Consolas, SF Mono, Monaco, monospace'
                  }}
                >
                  games/&lt;name&gt;/&lt;name&gt;-&lt;year&gt;.db
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
