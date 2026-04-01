// ─── WeeklyBarChart ───────────────────────────────────────────────────────────
//
// Hand-rolled SVG bar chart for weekly volume. No charting library: the chart
// is bars + a baseline + a few labels — uPlot/Recharts would add 40–360 kB for
// something 60 lines of SVG expresses, and a pure-SVG render is trivially
// testable (bars are just <rect> elements with data attributes).
//
// The SVG scales to its container via viewBox + width:100%, so the component
// carries no resize logic.

import type { ReactElement } from 'react'
import type { WeekBucket } from '@/lib/aggregates'

interface WeeklyBarChartProps {
  buckets: WeekBucket[]
  /** Which WeekBucket metric to plot. */
  metric: 'distanceKm' | 'movingTimeSec' | 'elevationGainM'
  /** Value formatter for the max-value label (units live with the caller). */
  formatValue: (value: number) => string
}

const W = 320
const H = 120
const LABEL_H = 16 // reserved strip under the bars for week labels

export function WeeklyBarChart({
  buckets,
  metric,
  formatValue,
}: WeeklyBarChartProps): ReactElement {
  const max = Math.max(...buckets.map((b) => b[metric]), 0)
  const barAreaH = H - LABEL_H
  // Cap bar width so a short history doesn't render three screen-wide slabs.
  const step = W / Math.max(buckets.length, 1)
  const barW = Math.min(step * 0.7, 28)

  const first = buckets.at(0)
  const last = buckets.at(-1)

  return (
    <svg
      viewBox={`0 0 ${String(W)} ${String(H)}`}
      className="w-full"
      role="img"
      aria-label="Weekly volume bar chart"
      data-testid="weekly-bar-chart"
    >
      {buckets.map((b, i) => {
        // Zero weeks render a 1px stub, not nothing: an invisible bar reads as
        // missing data, a stub reads as "trained zero that week" — which is
        // exactly what a gap in training is.
        const h = max > 0 ? (b[metric] / max) * (barAreaH - 14) : 0
        const x = i * step + (step - barW) / 2
        return (
          <rect
            key={b.week}
            x={x}
            y={barAreaH - Math.max(h, 1)}
            width={barW}
            height={Math.max(h, 1)}
            rx={2}
            className="fill-orange-500 dark:fill-orange-400"
            data-testid="weekly-bar"
            data-week={b.week}
          />
        )
      })}

      {/* Baseline */}
      <line
        x1="0"
        y1={barAreaH}
        x2={W}
        y2={barAreaH}
        className="stroke-slate-200 dark:stroke-slate-700"
      />

      {/* Max-value label, top-left — a single reference point beats a full axis
          at this size */}
      {max > 0 && (
        <text x="2" y="10" className="fill-slate-400 text-[9px] dark:fill-slate-500">
          {formatValue(max)}
        </text>
      )}

      {/* First / last week labels anchor the time span */}
      {first && (
        <text x="2" y={H - 4} className="fill-slate-400 text-[9px] dark:fill-slate-500">
          {first.week}
        </text>
      )}
      {last && buckets.length > 1 && (
        <text
          x={W - 2}
          y={H - 4}
          textAnchor="end"
          className="fill-slate-400 text-[9px] dark:fill-slate-500"
        >
          {last.week}
        </text>
      )}
    </svg>
  )
}
