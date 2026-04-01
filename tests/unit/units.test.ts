import { describe, it, expect } from 'vitest'
import {
  usesPace,
  formatDistance,
  formatDuration,
  formatElevation,
  formatPaceOrSpeed,
} from '@/lib/units'

// ─── Units & pace/speed convention ────────────────────────────────────────────

describe('usesPace (convention, not setting)', () => {
  it('Run/Walk/Hike are pace sports', () => {
    expect(usesPace('Run')).toBe(true)
    expect(usesPace('Walk')).toBe(true)
    expect(usesPace('Hike')).toBe(true)
  })

  it('Ride and everything else are speed sports', () => {
    expect(usesPace('Ride')).toBe(false)
    expect(usesPace('Swim')).toBe(false)
    expect(usesPace('Kitesurf')).toBe(false)
  })
})

describe('formatDistance', () => {
  it('formats km and converts to miles', () => {
    expect(formatDistance(10, 'km')).toBe('10.0 km')
    expect(formatDistance(10, 'mi')).toBe('6.2 mi')
  })
  it('renders null as em dash', () => {
    expect(formatDistance(null, 'km')).toBe('—')
  })
})

describe('formatDuration', () => {
  it('formats hours, minutes and bare seconds', () => {
    expect(formatDuration(3720)).toBe('1h 2m')
    expect(formatDuration(150)).toBe('2m')
    expect(formatDuration(38)).toBe('38s')
    expect(formatDuration(null)).toBe('—')
  })
})

describe('formatElevation', () => {
  it('metres for km users, feet for mi users', () => {
    expect(formatElevation(100, 'km')).toBe('100 m')
    expect(formatElevation(100, 'mi')).toBe('328 ft')
  })
})

describe('formatPaceOrSpeed', () => {
  it('renders pace min/km for runs', () => {
    // 10 km in 3000 s = 5:00 /km
    expect(formatPaceOrSpeed('Run', 10, 3000, 'km')).toBe('5:00 /km')
  })

  it('carries 60-second rounding into the minute (never "4:60")', () => {
    // 299.6 s/km rounds to 5:00, not 4:60.
    expect(formatPaceOrSpeed('Run', 10, 2996, 'km')).toBe('5:00 /km')
  })

  it('renders pace min/mi when units are miles', () => {
    // 10 km = 6.2137 mi in 3000 s → 482.8 s/mi = 8:03 /mi
    expect(formatPaceOrSpeed('Run', 10, 3000, 'mi')).toBe('8:03 /mi')
  })

  it('renders speed km/h for rides and mph in imperial', () => {
    // 40 km in 4800 s = 30 km/h
    expect(formatPaceOrSpeed('Ride', 40, 4800, 'km')).toBe('30.0 km/h')
    expect(formatPaceOrSpeed('Ride', 40, 4800, 'mi')).toBe('18.6 mph')
  })

  it('returns em dash on missing or zero inputs (no division by zero)', () => {
    expect(formatPaceOrSpeed('Run', null, 3000, 'km')).toBe('—')
    expect(formatPaceOrSpeed('Run', 10, null, 'km')).toBe('—')
    expect(formatPaceOrSpeed('Run', 0, 3000, 'km')).toBe('—')
  })
})
