// ─── ElevationProfile ─────────────────────────────────────────────────────────
//
// Hand-rolled SVG area chart: cumulative distance (x) vs elevation (y).
// Same visual language as WeeklyBarChart — viewBox-scaled, baseline, a single
// max-value reference label instead of a full axis, Tailwind fill classes for
// dark mode. An area (not a line) because climbers read elevation as terrain.

import type { ReactElement } from 'react'
import type { ParsedTrack } from '@/connectors/strava/trackParser'

const W = 320
const H = 120
const LABEL_H = 16 // strip under the area for the distance labels

interface ElevationProfileProps {
  track: ParsedTrack
  /** Formats a metre value for the max-elevation label (units live with caller). */
  formatElevation: (metres: number) => string
  /** Formats a km value for the end-distance label. */
  formatDistance: (km: number) => string
}

export function ElevationProfile({
  track,
  formatElevation,
  formatDistance,
}: ElevationProfileProps): ReactElement | null {
  // Pair each ele sample with its cumulative distance; points without ele are
  // simply not sampled (GPS units drop ele occasionally — a gap is noise here).
  const samples: Array<{ km: number; ele: number }> = []
  track.points.forEach((p, i) => {
    const km = track.cumulativeKm[i]
    if (p.ele !== undefined && km !== undefined) samples.push({ km, ele: p.ele })
  })

  // <2 ele points cannot make a profile — render nothing, the page skips the
  // section entirely (skip, not an error: flat-file GPX without ele is valid).
  if (samples.length < 2) return null

  const maxKm = samples.at(-1)?.km ?? 0
  const eles = samples.map((s) => s.ele)
  const minEle = Math.min(...eles)
  const maxEle = Math.max(...eles)
  // A dead-flat track still deserves a visible line — pad the domain.
  const eleSpan = Math.max(maxEle - minEle, 1)
  const chartH = H - LABEL_H

  const toX = (km: number) => (maxKm > 0 ? (km / maxKm) * W : 0)
  const toY = (ele: number) => chartH - ((ele - minEle) / eleSpan) * (chartH - 14)

  const line = samples.map((s) => `${toX(s.km).toFixed(1)},${toY(s.ele).toFixed(1)}`).join(' ')
  // Close the area down to the baseline on both ends.
  const area = `${String(toX(samples[0]?.km ?? 0))},${String(chartH)} ${line} ${String(toX(maxKm))},${String(chartH)}`

  return (
    <svg
      viewBox={`0 0 ${String(W)} ${String(H)}`}
      className="w-full"
      role="img"
      aria-label="Elevation profile"
      data-testid="elevation-profile"
    >
      <polygon points={area} className="fill-orange-500/20 dark:fill-orange-400/20" />
      <polyline
        points={line}
        fill="none"
        strokeWidth={1.5}
        className="stroke-orange-500 dark:stroke-orange-400"
      />

      {/* Baseline */}
      <line
        x1="0"
        y1={chartH}
        x2={W}
        y2={chartH}
        className="stroke-slate-200 dark:stroke-slate-700"
      />

      {/* Max-elevation reference, top-left — mirrors WeeklyBarChart's single
          reference point over a full axis */}
      <text x="2" y="10" className="fill-slate-400 text-[9px] dark:fill-slate-500">
        {formatElevation(maxEle)}
      </text>

      {/* 0 → total distance anchors the x span */}
      <text x="2" y={H - 4} className="fill-slate-400 text-[9px] dark:fill-slate-500">
        0
      </text>
      <text
        x={W - 2}
        y={H - 4}
        textAnchor="end"
        className="fill-slate-400 text-[9px] dark:fill-slate-500"
      >
        {formatDistance(maxKm)}
      </text>
    </svg>
  )
}
