// ─── BottomNav ────────────────────────────────────────────────────────────────
//
// Why bottom nav instead of a sidebar?
//
//   This is a mobile-first PWA installed on phones — a sidebar requires
//   a "hamburger" button or permanent screen real-estate that shrinks the content
//   area. Bottom tab bars place navigation controls within easy thumb reach on
//   large-screen phones (the "thumb zone" is the lower 60% of the screen). Both
//   iOS and Android native apps use this pattern heavily (iOS UITabBar,
//   Material NavigationBar), so users arrive with existing mental models.
//
// Active tab detection:
//   We use `useRouterState` to read the current pathname rather than a wrapping
//   <NavLink> component, because TanStack Router's Link doesn't expose an
//   `activeClassName` shortcut — we need to compute it manually anyway.

import { Link, useRouterState } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/theme/useTheme'
import type { ReactElement } from 'react'

// ─── Inline SVG Icons ─────────────────────────────────────────────────────────
//
// We inline SVGs instead of importing an icon library (lucide-react, heroicons,
// etc.) to keep the initial bundle small. Each icon is ~200 bytes vs. ~30 kB
// for a full icon set — significant at PWA install time on mobile networks.

function DashboardIcon({ active }: { active: boolean }): ReactElement {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      stroke="currentColor"
      strokeWidth={active ? 2.5 : 1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}

function ActivitiesIcon({ active }: { active: boolean }): ReactElement {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      stroke="currentColor"
      strokeWidth={active ? 2.5 : 1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Pulse waveform — universal "activity feed" glyph */}
      <polyline points="3 12 7 12 10 5 14 19 17 12 21 12" />
    </svg>
  )
}

function TrendsIcon({ active }: { active: boolean }): ReactElement {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      stroke="currentColor"
      strokeWidth={active ? 2.5 : 1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Bar chart — matches the weekly volume chart on the Trends page */}
      <line x1="5" y1="20" x2="5" y2="12" />
      <line x1="10" y1="20" x2="10" y2="8" />
      <line x1="15" y1="20" x2="15" y2="14" />
      <line x1="20" y1="20" x2="20" y2="4" />
    </svg>
  )
}

function SettingsIcon({ active }: { active: boolean }): ReactElement {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      stroke="currentColor"
      strokeWidth={active ? 2.5 : 1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

// Sun and moon icons for the theme toggle button
function SunIcon(): ReactElement {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  )
}

function MoonIcon(): ReactElement {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />
    </svg>
  )
}

// ─── Tab config ───────────────────────────────────────────────────────────────

type TabId = 'dashboard' | 'activities' | 'trends' | 'settings'

interface TabDef {
  id: TabId
  path: string
  // Strict match for '/' so /activities doesn't also activate dashboard
  exact?: boolean
  Icon: ({ active }: { active: boolean }) => ReactElement
}

const TABS: TabDef[] = [
  { id: 'dashboard', path: '/', exact: true, Icon: DashboardIcon },
  { id: 'activities', path: '/activities', Icon: ActivitiesIcon },
  { id: 'trends', path: '/trends', Icon: TrendsIcon },
  { id: 'settings', path: '/settings', Icon: SettingsIcon },
]

// ─── Component ────────────────────────────────────────────────────────────────

export function BottomNav(): ReactElement {
  const { t } = useTranslation('common')
  const { location } = useRouterState()
  const pathname = location.pathname
  // resolvedTheme gives us the actual displayed state (light/dark) including
  // when theme is 'system', so the button icon always reflects what's on screen.
  const { resolvedTheme, setTheme } = useTheme()

  function toggleTheme() {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }

  return (
    <nav
      className="fixed right-0 bottom-0 left-0 border-t border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
      // pb uses a CSS calc to add OS safe-area padding above the home indicator
      // on iPhone. --safe-area-bottom is set in styles.css from env(safe-area-inset-bottom).
      style={{ paddingBottom: 'calc(1rem + var(--safe-area-bottom))' }}
      aria-label="Main navigation"
    >
      <ul className="flex items-center pt-2">
        {TABS.map(({ id, path, exact, Icon }) => {
          const isActive = exact ? pathname === path : pathname.startsWith(path)

          return (
            <li key={id} className="flex-1">
              <Link
                to={path}
                className={`flex flex-col items-center gap-0.5 py-1 text-xs font-medium transition-colors ${
                  isActive
                    ? 'text-orange-600 dark:text-orange-400'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon active={isActive} />
                <span>{t(`nav.${id}`)}</span>
              </Link>
            </li>
          )
        })}
        {/* Theme toggle — not a nav destination, lives in the bar for one-tap
            access without navigating to Settings. Kept outside the tab <li>
            items so screen readers don't treat it as a navigation link. */}
        <li className="flex items-center pr-3">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="flex h-11 w-11 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            {resolvedTheme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
        </li>
      </ul>
    </nav>
  )
}
