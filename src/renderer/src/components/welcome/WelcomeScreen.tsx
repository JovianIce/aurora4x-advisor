import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card'
import { Button } from '@components/ui/button'
import { useSettings } from '@renderer/hooks/use-settings'
import { toast } from 'sonner'

export function WelcomeScreen(): React.JSX.Element {
  const navigate = useNavigate()
  const { settings } = useSettings()

  const handleNewGame = (): void => {
    if (!settings?.auroraDbPath) {
      toast.info('Database not configured', {
        description: 'Set your Aurora database path before starting a game'
      })
      navigate('/settings')
      return
    }
    navigate('/setup')
  }

  const handleLoadGame = (): void => {
    // TODO: Implement load existing save functionality
    alert('Load existing save functionality coming soon!')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-center">Aurora 4X Strategic Advisor</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="mb-6 text-muted-foreground">
            Your personal advisor for Aurora 4X strategic guidance
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={handleNewGame} size="lg">
              <span className="mr-2">🎮</span>
              Start a New Save
            </Button>
            <Button onClick={handleLoadGame} variant="outline" size="lg">
              <span className="mr-2">📂</span>
              Load Existing Save
            </Button>
          </div>
          <div className="mt-6 text-sm text-muted-foreground space-y-2">
            <p>📂 Use the sidebar to manage your games</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
