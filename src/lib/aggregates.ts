// ─── Weekly aggregates ────────────────────────────────────────────────────────
//
// Pure functions over Activity rows — the arithmetic behind the Dashboard's
// "this week at a glance" and the Trends charts. Kept free of Dexie/React so
// the exact numbers users see are directly unit-testable.
//
// Weeks are ISO 8601 weeks (Monday-start), keyed "YYYY-Www" — the ISO week
// year, not the calendar year, so the Dec/Jan boundary buckets correctly
// (2025-12-29 belongs to 2026-W01). date-fns provides the ISO week math; a
// hand-rolled implementation is where week-boundary bugs come from.

import { getISOWeek, getISOWeekYear, startOfISOWeek, subWeeks } from 'date-fns'
import type { Activity } from '@/db/schema'

export interface WeekTotals {
  distanceKm: number
  movingTimeSec: number
  elevationGainM: number
  count: number
}

export interface WeekBucket extends WeekTotals {
  /** ISO week key, e.g. "2026-W27". Lexicographic order === chronological order. */
  week: string
}

const EMPTY: WeekTotals = { distanceKm: 0, movingTimeSec: 0, elevationGainM: 0, count: 0 }

/** ISO week key ("YYYY-Www") for an ISO datetime string or Date. */
export function isoWeekKey(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const week = getISOWeek(d)
  return `${String(getISOWeekYear(d))}-W${String(week).padStart(2, '0')}`
}

function addToTotals(totals: WeekTotals, a: Activity): WeekTotals {
  // Null metrics contribute 0 — a manual activity without distance still
  // counts as an activity, and sums must never become NaN.
  return {
    distanceKm: totals.distanceKm + (a.distanceKm ?? 0),
    movingTimeSec: totals.movingTimeSec + (a.movingTimeSec ?? 0),
    elevationGainM: totals.elevationGainM + (a.elevationGainM ?? 0),
    count: totals.count + 1,
  }
}

/**
 * Sum activities into contiguous ISO-week buckets, oldest first.
 *
 * Weeks with no activities between the first and last recorded week are
 * emitted as zero buckets: the Trends bar chart must show gaps as gaps, not
 * silently compress a two-month injury break into adjacent bars.
 */
export function computeWeeklyTotals(activities: Activity[]): WeekBucket[] {
  if (activities.length === 0) return []

  const byWeek = new Map<string, WeekTotals>()
  let earliest: Date | null = null
  let latest: Date | null = null
  for (const a of activities) {
    const d = new Date(a.date)
    if (Number.isNaN(d.getTime())) continue // defensive — parser guarantees valid ISO
    const key = isoWeekKey(d)
    byWeek.set(key, addToTotals(byWeek.get(key) ?? EMPTY, a))
    if (earliest === null || d < earliest) earliest = d
    if (latest === null || d > latest) latest = d
  }
  if (earliest === null || latest === null) return []

  // Walk Monday to Monday to enumerate every week in the span — iterating by
  // week-start dates (not by incrementing week numbers) is immune to 52/53-week
  // year differences.
  const buckets: WeekBucket[] = []
  let cursor = startOfISOWeek(earliest)
  const end = startOfISOWeek(latest)
  while (cursor <= end) {
    const key = isoWeekKey(cursor)
    buckets.push({ week: key, ...(byWeek.get(key) ?? EMPTY) })
    cursor = subWeeks(cursor, -1)
  }
  return buckets
}

// ─── This week at a glance ────────────────────────────────────────────────────

export interface WeekAtAGlance {
  current: WeekTotals
  previous: WeekTotals
  /** current − previous, per metric. Always numeric: an empty week is a real 0. */
  delta: WeekTotals
}

/**
 * Totals for the ISO week containing `now`, the week before it, and the
 * week-over-week deltas.
 *
 * Calendar weeks (not rolling 7-day windows) by design: "this week" matches
 * how Strava itself presents weekly progress, and a Monday reset is what
 * training plans are built around.
 */
export function computeWeekAtAGlance(
  activities: Activity[],
  now: Date = new Date(),
): WeekAtAGlance {
  const currentKey = isoWeekKey(now)
  const previousKey = isoWeekKey(subWeeks(now, 1))

  let current = EMPTY
  let previous = EMPTY
  for (const a of activities) {
    const key = isoWeekKey(a.date)
    if (key === currentKey) current = addToTotals(current, a)
    else if (key === previousKey) previous = addToTotals(previous, a)
  }

  return {
    current,
    previous,
    delta: {
      distanceKm: current.distanceKm - previous.distanceKm,
      movingTimeSec: current.movingTimeSec - previous.movingTimeSec,
      elevationGainM: current.elevationGainM - previous.elevationGainM,
      count: current.count - previous.count,
    },
  }
}

// ─── Personal records ─────────────────────────────────────────────────────────

export interface PersonalRecord {
  activityId: string
  name: string
  /** ISO datetime of the record activity. */
  date: string
  value: number
}

export interface SportRecords {
  longestDistanceKm: PersonalRecord | null
  longestDurationSec: PersonalRecord | null
  mostElevationM: PersonalRecord | null
}

/**
 * Per-sport bests. `type` filters on Activity.type; null metrics never win
 * (an activity without distance can't hold the distance record). Ties keep
 * the earlier activity — the record was set first.
 */
export function computeRecords(activities: Activity[], type: string): SportRecords {
  let distance: PersonalRecord | null = null
  let duration: PersonalRecord | null = null
  let elevation: PersonalRecord | null = null

  // Oldest-first scan so strict > keeps the first activity to reach a value.
  const sorted = [...activities]
    .filter((a) => a.type === type)
    .sort((a, b) => (a.date < b.date ? -1 : 1))

  for (const a of sorted) {
    const record = (value: number): PersonalRecord => ({
      activityId: a.id,
      name: a.name,
      date: a.date,
      value,
    })
    if (a.distanceKm !== null && (distance === null || a.distanceKm > distance.value))
      distance = record(a.distanceKm)
    if (a.movingTimeSec !== null && (duration === null || a.movingTimeSec > duration.value))
      duration = record(a.movingTimeSec)
    if (a.elevationGainM !== null && (elevation === null || a.elevationGainM > elevation.value))
      elevation = record(a.elevationGainM)
  }

  return { longestDistanceKm: distance, longestDurationSec: duration, mostElevationM: elevation }
}

/** Distinct sport types, most-frequent first — drives the filter chips and
 * the Trends sport switcher without hardcoding Strava's open type set. */
export function sportTypes(activities: Activity[]): string[] {
  const counts = new Map<string, number>()
  for (const a of activities) {
    if (a.type === '') continue
    counts.set(a.type, (counts.get(a.type) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([type]) => type)
}
