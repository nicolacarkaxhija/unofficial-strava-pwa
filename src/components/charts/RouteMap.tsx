// ─── RouteMap ─────────────────────────────────────────────────────────────────
//
// Tile-free SVG polyline of the recorded track. No map tiles, ever: tiles mean
// network requests to a third party, which both the privacy promise and the
// CSP forbid. A bare polyline still answers the questions a detail page gets
// asked ("where did I go, roughly what shape was the loop") without leaking a
// single coordinate off-device.
//
// Projection: equirectangular with cos(midLatitude) longitude correction (see
// projectTrack) so mid/high-latitude tracks keep true local proportions.

import type { ReactElement } from 'react'
import { projectTrack } from '@/lib/geo'
import type { TrackPoint } from '@/connectors/strava/trackParser'

const W = 320
const H = 240
const PAD = 12

interface RouteMapProps {
  points: TrackPoint[]
  /** Pre-formatted distance string for the aria-label (units live with caller). */
  distanceLabel: string
}

export function RouteMap({ points, distanceLabel }: RouteMapProps): ReactElement | null {
  // One point draws nothing meaningful; the caller's guard should already
  // prevent this, but a chart must never render a broken artefact.
  if (points.length < 2) return null

  const projected = projectTrack(points, W, H, PAD)
  const path = projected.points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const start = projected.points.at(0)
  const end = projected.points.at(-1)

  return (
    <svg
      viewBox={`0 0 ${String(W)} ${String(H)}`}
      className="w-full"
      role="img"
      aria-label={`Route map, ${distanceLabel}`}
      data-testid="route-map"
    >
      <polyline
        points={path}
        fill="none"
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        className="stroke-orange-500 dark:stroke-orange-400"
        data-testid="route-polyline"
      />
      {/* Start green / end red — the universal convention, and the only two
          landmarks a tile-free map can offer. Drawn after the line so loops
          (start ≈ end) still show both dots. */}
      {start && (
        <circle
          cx={start.x}
          cy={start.y}
          r={4}
          className="fill-green-500"
          data-testid="route-start"
        />
      )}
      {end && (
        <circle cx={end.x} cy={end.y} r={4} className="fill-red-500" data-testid="route-end" />
      )}
    </svg>
  )
}
