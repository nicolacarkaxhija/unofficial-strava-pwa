import { useEffect, useState, type ReactNode } from 'react'
import { ThemeContext } from './ThemeContextDef'
import type { Theme } from './ThemeContextDef'

// ─── Dark Mode Strategy ────────────────────────────────────────────────────────
//
// Three modes: 'system' (follows prefers-color-scheme), 'light', 'dark'.
// The active mode is stored in localStorage under 'theme'.
//
// Implementation: we add/remove the `dark` class on <html>. Tailwind's
// `dark:` variants are activated by this class (configured in styles.css via
// `@variant dark (&:where(.dark, .dark *))`).
//
// We do NOT use a CSS media query as the sole mechanism because users expect
// to be able to override the system preference in Settings.
//
// Context creation and the useTheme hook live in separate .ts files so this
// .tsx only exports a single component (ThemeProvider), keeping react-refresh
// fast-refresh working correctly.

// Re-export Theme type for consumers that import it from this module path
export type { Theme } from './ThemeContextDef'

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme: Theme): void {
  const resolved = theme === 'system' ? getSystemTheme() : theme
  document.documentElement.classList.toggle('dark', resolved === 'dark')
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem('theme') as Theme | null
    // Default to 'light' — dark mode is an explicit user choice in Settings,
    // not the automatic experience. 'system' remains available but is not the
    // out-of-the-box default so first-time users always land in light mode.
    return stored ?? 'light'
  })

  const resolvedTheme = theme === 'system' ? getSystemTheme() : theme

  useEffect(() => {
    applyTheme(theme)

    // When theme is 'system', also listen for OS-level changes at runtime
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      applyTheme('system')
    }
    mq.addEventListener('change', handler)
    return () => {
      mq.removeEventListener('change', handler)
    }
  }, [theme])

  function setTheme(next: Theme) {
    localStorage.setItem('theme', next)
    setThemeState(next)
    applyTheme(next)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
