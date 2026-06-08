import { describe, it, expect } from 'vitest'
import {
  isoWeekKey,
  computeWeeklyTotals,
  computeWeekAtAGlance,
  computeRecords,
  rollingFourWeek,
  sportTypes,
} from '@/lib/aggregates'
import type { Activity } from '@/db/schema'

// Minimal Activity factory — aggregate math only reads date/type/metrics.
function act(overrides: Partial<Activity>): Activity {
  return {
    id: Math.random().toString(36).slice(2),
    date: '2026-06-15T08:00:00.000Z',
    name: 'Test',
    type: 'Run',
    distanceKm: 10,
    movingTimeSec: 3600,
    elapsedTimeSec: 3700,
    elevationGainM: 100,
    avgHeartRate: null,
    maxHeartRate: null,
    avgWatts: null,
    calories: null,
    fileRef: null,
    ...overrides,
  }
}

describe('isoWeekKey', () => {
  it('keys a mid-year date by its ISO week', () => {
    // 2026-06-15 is a Monday, ISO week 25 of 2026.
    expect(isoWeekKey('2026-06-15T08:00:00.000Z')).toBe('2026-W25')
  })

  it('uses the ISO week-year at the Dec/Jan boundary', () => {
    // 2025-12-29 is a Monday belonging to ISO week 1 of 2026 —
    // the classic boundary case a calendar-year key would bucket wrong.
    expect(isoWeekKey('2025-12-29T12:00:00.000Z')).toBe('2026-W01')
    // And 2027-01-01 (Friday) still belongs to 2026-W53.
    expect(isoWeekKey('2027-01-01T12:00:00.000Z')).toBe('2026-W53')
  })

  it('zero-pads single-digit weeks so string order is chronological', () => {
    expect(isoWeekKey('2026-01-07T12:00:00.000Z')).toBe('2026-W02')
  })
})

describe('computeWeeklyTotals', () => {
  it('returns [] for no activities', () => {
    expect(computeWeeklyTotals([])).toEqual([])
  })

  it('sums distance, time, elevation and count per ISO week', () => {
    const buckets = computeWeeklyTotals([
      act({
        date: '2026-06-15T08:00:00.000Z',
        distanceKm: 10,
        movingTimeSec: 3600,
        elevationGainM: 100,
      }),
      act({
        date: '2026-06-17T08:00:00.000Z',
        distanceKm: 5,
        movingTimeSec: 1800,
        elevationGainM: 50,
      }),
    ])
    expect(buckets).toHaveLength(1)
    expect(buckets[0]).toEqual({
      week: '2026-W25',
      distanceKm: 15,
      movingTimeSec: 5400,
      elevationGainM: 150,
      count: 2,
    })
  })

  it('splits activities on either side of a week boundary (Sun vs Mon)', () => {
    const buckets = computeWeeklyTotals([
      // Mid-day instants: ISO week bucketing is local-time based, and a
      // midnight-adjacent UTC instant would land in a different local day
      // depending on the machine's timezone — the test must not.
      act({ date: '2026-06-14T10:00:00.000Z' }), // Sunday → W24
      act({ date: '2026-06-15T10:00:00.000Z' }), // Monday → W25
    ])
    expect(buckets.map((b) => b.week)).toEqual(['2026-W24', '2026-W25'])
    expect(buckets.every((b) => b.count === 1)).toBe(true)
  })

  it('emits zero buckets for gap weeks between first and last activity', () => {
    const buckets = computeWeeklyTotals([
      act({ date: '2026-06-01T08:00:00.000Z' }), // W23
      act({ date: '2026-06-22T08:00:00.000Z' }), // W26
    ])
    expect(buckets.map((b) => b.week)).toEqual(['2026-W23', '2026-W24', '2026-W25', '2026-W26'])
    expect(buckets[1]?.count).toBe(0)
    expect(buckets[1]?.distanceKm).toBe(0)
  })

  it('treats null metrics as 0 while still counting the activity', () => {
    const buckets = computeWeeklyTotals([
      act({ distanceKm: null, movingTimeSec: null, elevationGainM: null }),
    ])
    expect(buckets[0]).toMatchObject({
      distanceKm: 0,
      movingTimeSec: 0,
      elevationGainM: 0,
      count: 1,
    })
  })
})

describe('computeWeekAtAGlance', () => {
  // Pin "now" to a Thursday so current/previous week membership is unambiguous.
  const now = new Date('2026-06-18T12:00:00.000Z') // W25

  it('buckets current week, previous week, and computes deltas', () => {
    const glance = computeWeekAtAGlance(
      [
        act({
          date: '2026-06-16T08:00:00.000Z',
          distanceKm: 12,
          movingTimeSec: 4000,
          elevationGainM: 80,
        }), // W25
        act({
          date: '2026-06-10T08:00:00.000Z',
          distanceKm: 8,
          movingTimeSec: 3000,
          elevationGainM: 120,
        }), // W24
        act({ date: '2026-06-01T08:00:00.000Z', distanceKm: 99 }), // W23 — must be ignored
      ],
      now,
    )
    expect(glance.current).toMatchObject({ distanceKm: 12, count: 1 })
    expect(glance.previous).toMatchObject({ distanceKm: 8, count: 1 })
    expect(glance.delta.distanceKm).toBe(4)
    expect(glance.delta.movingTimeSec).toBe(1000)
    expect(glance.delta.elevationGainM).toBe(-40)
    expect(glance.delta.count).toBe(0)
  })

  it('returns zero totals (not null) for an empty current week', () => {
    const glance = computeWeekAtAGlance(
      [act({ date: '2026-06-10T08:00:00.000Z', distanceKm: 8 })],
      now,
    )
    expect(glance.current.count).toBe(0)
    expect(glance.delta.distanceKm).toBe(-8)
  })

  it('handles the year boundary: Jan 1 vs the previous ISO week in December', () => {
    const janNow = new Date('2026-01-01T12:00:00.000Z') // 2026-W01
    const glance = computeWeekAtAGlance(
      [
        act({ date: '2025-12-30T08:00:00.000Z', distanceKm: 5 }), // 2026-W01 (same ISO week!)
        act({ date: '2025-12-25T08:00:00.000Z', distanceKm: 7 }), // 2025-W52 (previous)
      ],
      janNow,
    )
    expect(glance.current.distanceKm).toBe(5)
    expect(glance.previous.distanceKm).toBe(7)
  })
})

describe('computeRecords', () => {
  it('finds per-sport bests and ignores other sports', () => {
    const records = computeRecords(
      [
        act({ id: 'r1', type: 'Run', distanceKm: 21.1, movingTimeSec: 7200, elevationGainM: 200 }),
        act({ id: 'r2', type: 'Run', distanceKm: 10, movingTimeSec: 9000, elevationGainM: 500 }),
        act({
          id: 'b1',
          type: 'Ride',
          distanceKm: 120,
          movingTimeSec: 20000,
          elevationGainM: 2000,
        }),
      ],
      'Run',
    )
    expect(records.longestDistanceKm?.activityId).toBe('r1')
    expect(records.longestDurationSec?.activityId).toBe('r2')
    expect(records.mostElevationM?.activityId).toBe('r2')
  })

  it('null metrics never win a record', () => {
    const records = computeRecords([act({ distanceKm: null })], 'Run')
    expect(records.longestDistanceKm).toBeNull()
    // Other metrics still populated from the same activity.
    expect(records.longestDurationSec).not.toBeNull()
  })

  it('ties keep the earlier activity (the record was set first)', () => {
    const records = computeRecords(
      [
        act({ id: 'later', date: '2026-06-20T08:00:00.000Z', distanceKm: 10 }),
        act({ id: 'earlier', date: '2026-06-10T08:00:00.000Z', distanceKm: 10 }),
      ],
      'Run',
    )
    expect(records.longestDistanceKm?.activityId).toBe('earlier')
  })

  it('returns all-null records for a sport with no activities', () => {
    const records = computeRecords([act({ type: 'Run' })], 'Kitesurf')
    expect(records).toEqual({
      longestDistanceKm: null,
      longestDurationSec: null,
      mostElevationM: null,
    })
  })
})

describe('sportTypes', () => {
  it('returns distinct types, most frequent first, skipping empty', () => {
    const types = sportTypes([
      act({ type: 'Ride' }),
      act({ type: 'Run' }),
      act({ type: 'Ride' }),
      act({ type: '' }),
    ])
    expect(types).toEqual(['Ride', 'Run'])
  })
})

// ─── rollingFourWeek ──────────────────────────────────────────────────────────

describe('rollingFourWeek', () => {
  // Anchor: newest Run is 2026-06-15. Current window = the anchor's calendar
  // day plus the 27 days before it; previous = the 28 days before that.
  it('splits activities into current/previous 28-day windows and computes the delta', () => {
    const result = rollingFourWeek(
      [
        act({ date: '2026-06-15T08:00:00.000Z', distanceKm: 10 }), // anchor, current
        act({ date: '2026-06-01T08:00:00.000Z', distanceKm: 5 }), // current
        act({ date: '2026-05-10T08:00:00.000Z', distanceKm: 7 }), // previous
        act({ date: '2026-03-01T08:00:00.000Z', distanceKm: 99 }), // before both — ignored
      ],
      'distanceKm',
      'Run',
    )
    expect(result).toEqual({ current: 15, previous: 7, delta: 8 })
  })

  it('anchors on the newest activity date, NOT today — stale exports still compare', () => {
    // Everything is years in the past; a "today"-anchored window would be empty.
    const result = rollingFourWeek(
      [
        act({ date: '2023-04-20T08:00:00.000Z', distanceKm: 12 }),
        act({ date: '2023-04-01T08:00:00.000Z', distanceKm: 8 }),
      ],
      'distanceKm',
      'Run',
    )
    expect(result?.current).toBe(20)
  })

  it('treats the window boundary as half-open: day 27 back is current, day 28 back is previous', () => {
    const result = rollingFourWeek(
      [
        act({ date: '2026-06-15T08:00:00.000Z', distanceKm: 1 }), // anchor day
        act({ date: '2026-05-19T08:00:00.000Z', distanceKm: 2 }), // 27 days back → current
        act({ date: '2026-05-18T08:00:00.000Z', distanceKm: 4 }), // 28 days back → previous
      ],
      'distanceKm',
      'Run',
    )
    expect(result).toEqual({ current: 3, previous: 4, delta: -1 })
  })

  it('a gap in the previous window yields previous 0 and a fully-positive delta', () => {
    const result = rollingFourWeek(
      [act({ date: '2026-06-15T08:00:00.000Z', movingTimeSec: 3600 })],
      'movingTimeSec',
      'Run',
    )
    expect(result).toEqual({ current: 3600, previous: 0, delta: 3600 })
  })

  it('only counts the requested sport', () => {
    const result = rollingFourWeek(
      [
        act({ date: '2026-06-15T08:00:00.000Z', type: 'Run', distanceKm: 10 }),
        act({ date: '2026-06-14T08:00:00.000Z', type: 'Ride', distanceKm: 50 }),
      ],
      'distanceKm',
      'Run',
    )
    expect(result?.current).toBe(10)
  })

  it('null metrics contribute 0, never NaN', () => {
    const result = rollingFourWeek(
      [act({ date: '2026-06-15T08:00:00.000Z', elevationGainM: null })],
      'elevationGainM',
      'Run',
    )
    expect(result).toEqual({ current: 0, previous: 0, delta: 0 })
  })

  it('returns null when the sport has no activities to anchor on', () => {
    expect(rollingFourWeek([act({ type: 'Ride' })], 'distanceKm', 'Run')).toBeNull()
  })
})
