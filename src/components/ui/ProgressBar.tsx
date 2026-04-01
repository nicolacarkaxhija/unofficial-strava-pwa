// ─── ProgressBar ──────────────────────────────────────────────────────────────
//
// Animated progress bar intended for import/loading flows.
// Uses a CSS transition rather than a JS animation so the browser can
// GPU-accelerate the width change without a JS frame loop.

import type { ReactElement } from 'react'

interface ProgressBarProps {
  pct: number
  label?: string
}

export function ProgressBar({ pct, label }: ProgressBarProps): ReactElement {
  const clamped = Math.max(0, Math.min(100, pct))

  return (
    <div className="w-full space-y-1">
      {label !== undefined && <p className="text-sm text-gray-600 dark:text-gray-400">{label}</p>}
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className="h-full rounded-full bg-sky-500 transition-[width] duration-300 ease-out dark:bg-sky-400"
          style={{ width: `${clamped.toString()}%` }}
        />
      </div>
    </div>
  )
}
