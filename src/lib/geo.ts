// ─── Geo math ─────────────────────────────────────────────────────────────────
//
// Pure math shared by the track parser (derived totals) and the route/elevation
// SVGs. Kept free of DOM and React so it is trivially unit-testable and can
// later move into a worker unchanged if parsing ever needs to leave the main
// thread.

export interface LatLon {
  lat: number
  lon: number
}

const EARTH_RADIUS_KM = 6371

/**
 * Great-circle distance between two points in km (haversine).
 *
 * Haversine over the simpler equirectangular approximation because track
 * totals accumulate error over thousands of points — haversine keeps the
 * derived distance within GPS noise of Strava's own figure at no meaningful
 * CPU cost for a one-file parse.
 */
export function haversineKm(a: LatLon, b: LatLon): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const sinLat = Math.sin(dLat / 2)
  const sinLon = Math.sin(dLon / 2)
  const h = sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLon * sinLon
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Running cumulative distance (km) per point; index 0 is always 0. */
export function cumulativeDistanceKm(points: LatLon[]): number[] {
  const out: number[] = []
  let total = 0
  let prev: LatLon | null = null
  for (const p of points) {
    if (prev !== null) total += haversineKm(prev, p)
    out.push(total)
    prev = p
  }
  return out
}

export interface ProjectedTrack {
  /** Points in SVG user units, y already flipped (north = up). */
  points: Array<{ x: number; y: number }>
  width: number
  height: number
}

/**
 * Project lat/lon onto a flat SVG plane, scaled to fit width×height (minus
 * padding) while preserving aspect ratio.
 *
 * Equirectangular with a cos(midLatitude) longitude correction: at latitude φ
 * one degree of longitude spans cos(φ) times the distance of one degree of
 * latitude, so plotting raw degrees squashes tracks vertically the further
 * they are from the equator (a square city block in Oslo would render twice
 * as wide as tall). Multiplying Δlon by cos(midLat) restores true local
 * proportions — plenty accurate for activity-sized extents (a few km to a few
 * hundred km), where a full Mercator would be indistinguishable.
 */
export function projectTrack(
  points: LatLon[],
  width: number,
  height: number,
  padding = 0,
): ProjectedTrack {
  if (points.length === 0) return { points: [], width, height }

  const lats = points.map((p) => p.lat)
  const lons = points.map((p) => p.lon)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLon = Math.min(...lons)
  const maxLon = Math.max(...lons)
  const midLat = (minLat + maxLat) / 2
  const lonScale = Math.cos((midLat * Math.PI) / 180)

  const spanX = (maxLon - minLon) * lonScale
  const spanY = maxLat - minLat
  const innerW = width - padding * 2
  const innerH = height - padding * 2

  // Guard the degenerate cases (single point, perfectly straight N–S or E–W
  // line): a zero span would divide by zero, so fall back to a unit span that
  // centres the track instead.
  const scale = Math.min(innerW / Math.max(spanX, 1e-9), innerH / Math.max(spanY, 1e-9))

  // Centre the fitted track inside the box on both axes.
  const offsetX = (width - spanX * scale) / 2
  const offsetY = (height - spanY * scale) / 2

  return {
    points: points.map((p) => ({
      x: offsetX + (p.lon - minLon) * lonScale * scale,
      // SVG y grows downward; latitude grows upward — flip so north is up.
      y: offsetY + (maxLat - p.lat) * scale,
    })),
    width,
    height,
  }
}
