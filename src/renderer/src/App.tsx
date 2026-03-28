import { useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { GameProvider } from './contexts/game-provider'
import { AuroraDataProvider } from './contexts/aurora-data-context'
import { router } from './router'
import { toast } from 'sonner'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1
    }
  }
})

function useZoomToast(): void {
  useEffect(() => {
    return window.api.zoom.onChanged((pct) => {
      toast(`Zoom: ${pct}%`, {
        id: 'zoom-level',
        duration: 2000,
        action: pct !== 100
          ? { label: 'Reset', onClick: () => window.api.zoom.reset() }
          : undefined
      })
    })
  }, [])
}

function App(): React.JSX.Element {
  useZoomToast()
  return (
    <QueryClientProvider client={queryClient}>
      <GameProvider>
        <AuroraDataProvider>
          <RouterProvider router={router} />
        </AuroraDataProvider>
      </GameProvider>
    </QueryClientProvider>
  )
}

export default App
