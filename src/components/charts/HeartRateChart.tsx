// ─── HeartRateChart ───────────────────────────────────────────────────────────
//
// HR (bpm) over elapsed time, as a plain SVG line. Elapsed time on x (not
// cumulative distance) because HR is a physiological time series — a long
// stop at a junction should show as a flat stretch, not vanish.
//
// HR zones are deliberately deferred: zone bands need a user max-HR setting
// that doesn't exist yet, and guessing 220-age from nothing would be wrong
// more often than useful.
//
// x falls back to sample index when the track has HR but no timestamps (rare,
// but a permissive parser can produce it) — shape is preserved either way.

import type { ReactElement } from 'react'
import type { TrackPoint } from '@/connectors/strava/trackParser'

const W = 320
const H = 120
const LABEL_H = 16

interface HeartRateChartProps {
  points: TrackPoint[]
  /** Formats elapsed seconds for the end-of-axis label. */
  formatDuration: (seconds: number) => string
}

export function HeartRateChart({
  points,
  formatDuration,
}: HeartRateChartProps): ReactElement | null {
  const startTime = points.find((p) => p.time !== undefined)?.time
  const samples: Array<{ x: number; hr: number }> = []
  points.forEach((p, i) => {
    if (p.hr === undefined) return
    // Elapsed seconds when timestamps exist, sample index otherwise.
    const x = p.time !== undefined && startTime !== undefined ? (p.time - startTime) / 1000 : i
    samples.push({ x, hr: p.hr })
  })

  if (samples.length < 2) return null

  const maxX = Math.max(samples.at(-1)?.x ?? 0, 1)
  const hrs = samples.map((s) => s.hr)
  const minHr = Math.min(...hrs)
  const maxHr = Math.max(...hrs)
  const hrSpan = Math.max(maxHr - minHr, 1)
  const chartH = H - LABEL_H

  const line = samples
    .map((s) => {
      const x = (s.x / maxX) * W
      const y = chartH - ((s.hr - minHr) / hrSpan) * (chartH - 14) - 2
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  const hasTime = startTime !== undefined

  return (
    <svg
      viewBox={`0 0 ${String(W)} ${String(H)}`}
      className="w-full"
      role="img"
      aria-label="Heart rate over time"
      data-testid="hr-chart"
    >
      <polyline
        points={line}
        fill="none"
        strokeWidth={1.5}
        // rose, not orange: HR is conventionally red and must not read as a
        // second elevation profile at a glance.
        className="stroke-rose-500 dark:stroke-rose-400"
      />

      <line
        x1="0"
        y1={chartH}
        x2={W}
        y2={chartH}
        className="stroke-slate-200 dark:stroke-slate-700"
      />

      {/* Max/min bpm reference labels */}
      <text x="2" y="10" className="fill-slate-400 text-[9px] dark:fill-slate-500">
        {String(maxHr)} bpm
      </text>
      <text x="2" y={chartH - 4} className="fill-slate-400 text-[9px] dark:fill-slate-500">
        {String(minHr)}
      </text>

      {/* Elapsed-time span label only when real timestamps back the axis */}
      {hasTime && (
        <text
          x={W - 2}
          y={H - 4}
          textAnchor="end"
          className="fill-slate-400 text-[9px] dark:fill-slate-500"
        >
          {formatDuration(maxX)}
        </text>
      )}
    </svg>
  )
}
