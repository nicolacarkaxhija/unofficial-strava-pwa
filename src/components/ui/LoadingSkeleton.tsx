// ─── LoadingSkeleton ──────────────────────────────────────────────────────────
//
// Generic shimmer placeholder. The caller controls shape via `className`
// (e.g. `h-4 w-full rounded` for a text line, `h-20 w-20 rounded-full` for an
// avatar). We avoid shipping a fixed set of variants because callers know their
// own layout — a flexible primitive is more reusable than a rigid component.

import type { ReactElement } from 'react'

interface LoadingSkeletonProps {
  className?: string
}

export function LoadingSkeleton({ className = '' }: LoadingSkeletonProps): ReactElement {
  return (
    <div
      className={`animate-pulse rounded bg-gray-200 dark:bg-gray-700 ${className}`}
      aria-hidden="true"
    />
  )
}
