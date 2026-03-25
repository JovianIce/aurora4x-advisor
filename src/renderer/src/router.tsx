import { createHashRouter } from 'react-router-dom'
import { RootLayout } from './components/layout/RootLayout'
import { WelcomeScreen } from './components/welcome/WelcomeScreen'
import { SetupWizard } from './components/setup/SetupWizard'
import { DashboardLayout } from './components/pages/dashboard'
import { SettingsPage } from './components/pages/settings'

export const router = createHashRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: <WelcomeScreen />
      },
      {
        path: 'setup',
        element: <SetupWizard />
      },
      {
        path: 'settings',
        element: <SettingsPage />
      },
      {
        path: 'dashboard',
        element: <DashboardLayout />
      }
    ]
  }
])
