// ─── SportIcon ────────────────────────────────────────────────────────────────
//
// Small inline-SVG glyph per sport type, used in activity list rows.
// Inline SVGs (not an icon library) keep the bundle small — see BottomNav for
// the same rationale. Strava's type set is open-ended, so unknown sports fall
// back to a generic pulse glyph rather than rendering nothing.

import type { ReactElement } from 'react'

interface SportIconProps {
  type: string
  className?: string
}

function pathFor(type: string): ReactElement {
  switch (type) {
    case 'Run':
      // Simple runner-motion chevrons
      return (
        <>
          <circle cx="15" cy="5" r="2" />
          <path d="M9 20l3-6 2 2 2 4" />
          <path d="M7 12l4-3 3 2 3-1" />
        </>
      )
    case 'Ride':
    case 'Virtual Ride':
      return (
        <>
          <circle cx="6" cy="17" r="4" />
          <circle cx="18" cy="17" r="4" />
          <path d="M6 17l4-8h5l3 8M10 9l-1-3h3" />
        </>
      )
    case 'Walk':
    case 'Hike':
      return (
        <>
          <path d="M4 20l6-14 4 5 2-3 4 12" />
        </>
      )
    case 'Swim':
      return (
        <>
          <path d="M2 16c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
          <path d="M2 20c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
          <circle cx="16" cy="7" r="2" />
        </>
      )
    default:
      // Generic pulse — any sport is still an effort over time
      return <polyline points="3 12 7 12 10 5 14 19 17 12 21 12" />
  }
}

export function SportIcon({ type, className = '' }: SportIconProps): ReactElement {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {pathFor(type)}
    </svg>
  )
}
