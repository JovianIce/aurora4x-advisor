import { createContext } from 'react'

export const THEME_IDS = ['cic', 'solaris', 'nebula', 'terran', 'eclipse'] as const
export type ThemeId = (typeof THEME_IDS)[number]

export interface ThemeMeta {
  id: ThemeId
  label: string
  description: string
  /** Preview swatch color (the primary accent hex) */
  swatch: string
}

export const THEMES: ThemeMeta[] = [
  {
    id: 'cic',
    label: 'CIC',
    description: 'Tactical cyan — military command center',
    swatch: '#00e5ff'
  },
  {
    id: 'solaris',
    label: 'Solaris',
    description: 'Solar gold — warm stellar command',
    swatch: '#ffca28'
  },
  {
    id: 'nebula',
    label: 'Nebula',
    description: 'Cosmic violet — deep space observatory',
    swatch: '#bf7fff'
  },
  {
    id: 'terran',
    label: 'Terran',
    description: 'Command green — earth colonial ops',
    swatch: '#4cff82'
  },
  {
    id: 'eclipse',
    label: 'Eclipse',
    description: 'Searing crimson — aggressive combat',
    swatch: '#ff3d3d'
  }
]

export type ThemeProviderState = {
  theme: ThemeId
  setTheme: (theme: ThemeId) => void
}

const initialState: ThemeProviderState = {
  theme: 'cic',
  setTheme: () => null
}

export const ThemeProviderContext = createContext<ThemeProviderState>(initialState)
