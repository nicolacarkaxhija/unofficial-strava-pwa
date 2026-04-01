// ─── Units ────────────────────────────────────────────────────────────────────
//
// km/mi is a display concern only: the database always stores metric (km, m,
// seconds) exactly as parsed. Converting at render time means a units toggle
// never requires touching stored data.
//
// Pace vs speed is decided by sport convention, NOT by a setting: runners and
// walkers think in min/km, cyclists in km/h. Encoding the convention keeps the
// UI free of a confusing per-metric preference.

export type Units = 'km' | 'mi'

const STORAGE_KEY = 'units'
// Custom event lets every useUnits() subscriber re-render on change without a
// context provider — same lightweight pattern as the theme's localStorage key.
export const UNITS_EVENT = 'strava:units'

const KM_PER_MILE = 1.609344

export function getStoredUnits(): Units {
  return localStorage.getItem(STORAGE_KEY) === 'mi' ? 'mi' : 'km'
}

export function setStoredUnits(units: Units): void {
  localStorage.setItem(STORAGE_KEY, units)
  window.dispatchEvent(new Event(UNITS_EVENT))
}

/** Sports displayed as pace (min per unit distance); everything else is speed. */
const PACE_SPORTS = new Set(['Run', 'Walk', 'Hike'])

export function usesPace(type: string): boolean {
  return PACE_SPORTS.has(type)
}

// ─── Formatting ───────────────────────────────────────────────────────────────

export function formatDistance(distanceKm: number | null, units: Units): string {
  if (distanceKm === null) return '—'
  const value = units === 'mi' ? distanceKm / KM_PER_MILE : distanceKm
  return `${value.toFixed(1)} ${units}`
}

/** Seconds → "4h 12m" / "42m" / "38s". Hours never roll into days: a 30-hour
 * ultra reading "30h" is clearer than "1d 6h". */
export function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—'
  const s = Math.round(seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${String(h)}h ${String(m)}m`
  if (m > 0) return `${String(m)}m`
  return `${String(s)}s`
}

export function formatElevation(elevationM: number | null, units: Units): string {
  if (elevationM === null) return '—'
  // Feet for imperial users — elevation in miles would be absurd.
  const value = units === 'mi' ? elevationM * 3.28084 : elevationM
  return `${String(Math.round(value))} ${units === 'mi' ? 'ft' : 'm'}`
}

/**
 * Pace (min/km or min/mi) for pace sports, speed (km/h or mph) otherwise.
 * Returns "—" when either input is missing or zero — a 0-distance pace is a
 * division by zero, not a datum.
 */
export function formatPaceOrSpeed(
  type: string,
  distanceKm: number | null,
  movingTimeSec: number | null,
  units: Units,
): string {
  if (distanceKm === null || movingTimeSec === null || distanceKm <= 0 || movingTimeSec <= 0)
    return '—'
  const distance = units === 'mi' ? distanceKm / KM_PER_MILE : distanceKm

  if (usesPace(type)) {
    const secPerUnit = movingTimeSec / distance
    const min = Math.floor(secPerUnit / 60)
    const sec = Math.round(secPerUnit % 60)
    // 59.6 s rounds to 60 — carry into the minute instead of printing "4:60".
    const carried = sec === 60 ? { min: min + 1, sec: 0 } : { min, sec }
    return `${String(carried.min)}:${String(carried.sec).padStart(2, '0')} /${units}`
  }

  const speed = distance / (movingTimeSec / 3600)
  return `${speed.toFixed(1)} ${units === 'mi' ? 'mph' : 'km/h'}`
}
