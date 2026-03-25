import React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card'
import { Button } from '@components/ui/button'
import { Badge } from '@components/ui/badge'
import { toast } from 'sonner'

export function SettingsPage(): React.JSX.Element {
  const queryClient = useQueryClient()

  // Load settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => window.api.settings.load()
  })

  // Load watcher status
  const { data: watcherStatus } = useQuery({
    queryKey: ['dbWatcher', 'status'],
    queryFn: () => window.api.dbWatcher.getStatus(),
    refetchInterval: 2000 // Poll every 2 seconds
  })

  // Mutation: Pick Aurora DB file
  const pickFileMutation = useMutation({
    mutationFn: async () => {
      const filePath = await window.api.dbWatcher.pickFile()
      if (!filePath) {
        throw new Error('No file selected')
      }
      return filePath
    },
    onSuccess: async (filePath) => {
      // Update watcher with new path
      await window.api.dbWatcher.setPath(filePath)
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      queryClient.invalidateQueries({ queryKey: ['dbWatcher', 'status'] })
      toast.success('Aurora database path updated', {
        description: 'File watcher is now monitoring your database'
      })
    },
    onError: (error) => {
      if (error.message !== 'No file selected') {
        toast.error('Failed to set database path', {
          description: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }
  })

  // Mutation: Clear database path
  const clearPathMutation = useMutation({
    mutationFn: async () => {
      await window.api.dbWatcher.setPath(null)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      queryClient.invalidateQueries({ queryKey: ['dbWatcher', 'status'] })
      toast.success('Aurora database path cleared', {
        description: 'File watcher has been stopped'
      })
    }
  })

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-2">Configure your Aurora 4X Advisor</p>
        </div>

        {/* Aurora Database Path */}
        <Card>
          <CardHeader>
            <CardTitle>Aurora Database</CardTitle>
            <CardDescription>
              Configure the path to your Aurora 4X database file (AuroraDB.db)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Current Path */}
            <div>
              <label className="text-sm font-medium">Current Path</label>
              <div className="mt-2 p-3 bg-muted rounded-md font-mono text-sm break-all">
                {settings?.auroraDbPath || (
                  <span className="text-muted-foreground italic">No database path configured</span>
                )}
              </div>
            </div>

            {/* Watcher Status */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Status:</label>
              {watcherStatus?.isWatching ? (
                <Badge className="bg-green-500 hover:bg-green-600">
                  <span className="mr-1">●</span> Watching
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <span className="mr-1">○</span> Not Watching
                </Badge>
              )}
              {watcherStatus?.currentGameId && (
                <Badge variant="outline" className="text-xs">
                  Active Game
                </Badge>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                onClick={() => pickFileMutation.mutate()}
                disabled={pickFileMutation.isPending}
              >
                {pickFileMutation.isPending ? 'Selecting...' : 'Select Database File'}
              </Button>
              {settings?.auroraDbPath && (
                <Button
                  variant="outline"
                  onClick={() => clearPathMutation.mutate()}
                  disabled={clearPathMutation.isPending}
                >
                  Clear Path
                </Button>
              )}
            </div>

            {/* Help Text */}
            <div className="text-xs text-muted-foreground space-y-1 pt-2">
              <p>
                <strong>How to find your Aurora database:</strong>
              </p>
              <ul className="list-disc list-inside space-y-0.5 ml-2">
                <li>In your Aurora 4X installation folder</li>
                <li>The file is named &quot;AuroraDB.db&quot;</li>
                <li>The advisor will watch this file and create snapshots when it changes</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Database Watcher Info */}
        <Card>
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
            <CardDescription>Understanding the database snapshot system</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 rounded-lg p-3">
              <h4 className="font-semibold mb-1 text-yellow-900 dark:text-yellow-200">
                ⚠️ Important
              </h4>
              <p className="text-yellow-800 dark:text-yellow-300 text-xs">
                Make sure the correct game is selected in the sidebar before saving in Aurora 4X.
                The advisor will create snapshots in the folder of the currently selected game. If
                you switch games in Aurora without switching in the advisor, snapshots will be saved
                to the wrong location.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-1">Automatic Snapshots</h4>
              <p className="text-muted-foreground">
                When you save your game in Aurora 4X, the advisor automatically creates a snapshot
                of your database. Snapshots are organized by game name and in-game year.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-1">Snapshot Location</h4>
              <p className="text-muted-foreground font-mono text-xs break-all">
                Snapshots are stored in your app data folder:
                <br />
                <code className="bg-muted px-1 py-0.5 rounded mt-1 inline-block">
                  games/&lt;game-name&gt;/&lt;game-name&gt;-&lt;year&gt;.db
                </code>
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-1">Example</h4>
              <p className="text-muted-foreground">
                For a game called &quot;Example Game&quot; at year 50, the snapshot would be:
                <br />
                <code className="bg-muted px-1 py-0.5 rounded mt-1 inline-block text-xs">
                  games/Example Game/Example Game-50.db
                </code>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
