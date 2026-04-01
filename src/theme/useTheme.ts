import { useContext } from 'react'
import { ThemeContext } from './ThemeContextDef'
import type { ThemeContextValue } from './ThemeContextDef'

// ─── useTheme ─────────────────────────────────────────────────────────────────
//
// Extracted into its own .ts file so ThemeContext.tsx can export only the
// ThemeProvider component. Exporting a hook alongside a component from a .tsx
// file triggers the react-refresh/only-export-components warning — HMR fast-
// refresh works best when .tsx files export a single component.

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}
