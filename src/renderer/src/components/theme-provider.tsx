import { useEffect, useState } from 'react'
import { ThemeProviderContext, THEME_IDS, type ThemeId } from '@renderer/contexts/theme-context'

const STORAGE_KEY = 'aurora4x-ui-theme'

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: ThemeId
}

export function ThemeProvider({
  children,
  defaultTheme = 'cic',
  ...props
}: ThemeProviderProps): React.JSX.Element {
  const [theme, setThemeState] = useState<ThemeId>(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && THEME_IDS.includes(stored as ThemeId)) return stored as ThemeId
    return defaultTheme
  })

  useEffect(() => {
    const root = window.document.documentElement
    // All themes are dark
    root.classList.add('dark')
    // Set the named theme via data attribute
    root.setAttribute('data-theme', theme)
  }, [theme])

  const value = {
    theme,
    setTheme: (t: ThemeId) => {
      localStorage.setItem(STORAGE_KEY, t)
      setThemeState(t)
    }
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}
