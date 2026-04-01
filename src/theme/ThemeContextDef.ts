import { createContext } from 'react'

// ─── ThemeContext Definition ──────────────────────────────────────────────────
//
// Split into its own .ts file so ThemeContext.tsx can export only ThemeProvider
// (a component) and useTheme.ts can export only the hook — keeping both files
// safe from the react-refresh/only-export-components warning.

export type Theme = 'system' | 'light' | 'dark'

export interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
  resolvedTheme: 'light' | 'dark'
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)
