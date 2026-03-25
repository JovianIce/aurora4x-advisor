import './assets/index.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ThemeProvider } from './components/theme-provider'
import { Toaster } from '@components/ui/sonner'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="cic">
      <App />
      <Toaster />
    </ThemeProvider>
  </StrictMode>
)
