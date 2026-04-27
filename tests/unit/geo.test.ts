import { describe, it, expect } from 'vitest'
import { haversineKm, cumulativeDistanceKm, projectTrack } from '@/lib/geo'

// ─── Haversine ────────────────────────────────────────────────────────────────

describe('haversineKm', () => {
  it('is zero for identical points', () => {
    const p = { lat: 45.472, lon: 9.172 }
    expect(haversineKm(p, p)).toBe(0)
  })

  it('matches a known reference distance (Milan Duomo → Turin ≈ 125 km)', () => {
    const milan = { lat: 45.4642, lon: 9.19 }
    const turin = { lat: 45.0703, lon: 7.6869 }
    const d = haversineKm(milan, turin)
    expect(d).toBeGreaterThan(120)
    expect(d).toBeLessThan(130)
  })

  it('one degree of latitude is ~111 km regardless of longitude', () => {
    expect(haversineKm({ lat: 0, lon: 0 }, { lat: 1, lon: 0 })).toBeCloseTo(111.2, 0)
    expect(haversineKm({ lat: 45, lon: 9 }, { lat: 46, lon: 9 })).toBeCloseTo(111.2, 0)
  })

  it('one degree of longitude shrinks with latitude (cos φ)', () => {
    const atEquator = haversineKm({ lat: 0, lon: 0 }, { lat: 0, lon: 1 })
    const at60 = haversineKm({ lat: 60, lon: 0 }, { lat: 60, lon: 1 })
    expect(at60 / atEquator).toBeCloseTo(0.5, 1)
  })

  it('is symmetric', () => {
    const a = { lat: 45.1, lon: 9.1 }
    const b = { lat: 45.2, lon: 9.3 }
    expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 12)
  })
})

// ─── Cumulative distance ──────────────────────────────────────────────────────

describe('cumulativeDistanceKm', () => {
  it('returns [] for no points and [0] for a single point', () => {
    expect(cumulativeDistanceKm([])).toEqual([])
    expect(cumulativeDistanceKm([{ lat: 1, lon: 1 }])).toEqual([0])
  })

  it('is monotonically non-decreasing and starts at 0', () => {
    const points = [
      { lat: 45.0, lon: 9.0 },
      { lat: 45.01, lon: 9.0 },
      { lat: 45.01, lon: 9.01 },
      { lat: 45.0, lon: 9.0 },
    ]
    const cum = cumulativeDistanceKm(points)
    expect(cum[0]).toBe(0)
    for (let i = 1; i < cum.length; i++) {
      expect(cum[i]).toBeGreaterThanOrEqual(cum[i - 1] ?? 0)
    }
    expect(cum).toHaveLength(points.length)
  })
})

// ─── Projection ───────────────────────────────────────────────────────────────

describe('projectTrack', () => {
  it('returns empty output for empty input', () => {
    expect(projectTrack([], 100, 100).points).toEqual([])
  })

  it('fits all points inside the box (with padding)', () => {
    const points = [
      { lat: 45.472, lon: 9.172 },
      { lat: 45.4756, lon: 9.179 },
      { lat: 45.47, lon: 9.175 },
    ]
    const { points: proj } = projectTrack(points, 320, 240, 12)
    for (const p of proj) {
      expect(p.x).toBeGreaterThanOrEqual(12 - 1e-6)
      expect(p.x).toBeLessThanOrEqual(320 - 12 + 1e-6)
      expect(p.y).toBeGreaterThanOrEqual(12 - 1e-6)
      expect(p.y).toBeLessThanOrEqual(240 - 12 + 1e-6)
    }
  })

  it('flips y so north is up', () => {
    const south = { lat: 45.0, lon: 9.0 }
    const north = { lat: 45.01, lon: 9.0 }
    const { points: proj } = projectTrack([south, north], 100, 100)
    const [pSouth, pNorth] = proj
    expect(pNorth && pSouth && pNorth.y < pSouth.y).toBe(true)
  })

  it('applies the cos(midLatitude) longitude correction (no squashing)', () => {
    // A square in ground metres at 60°N: Δlat = d, Δlon = d / cos(60°) = 2d.
    // Without the correction, the projected shape would be twice as wide as
    // tall; with it, width ≈ height.
    const d = 0.01
    const square = [
      { lat: 60, lon: 9 },
      { lat: 60 + d, lon: 9 },
      { lat: 60 + d, lon: 9 + d / Math.cos((60 * Math.PI) / 180) },
      { lat: 60, lon: 9 + d / Math.cos((60 * Math.PI) / 180) },
    ]
    const { points: proj } = projectTrack(square, 200, 200)
    const xs = proj.map((p) => p.x)
    const ys = proj.map((p) => p.y)
    const width = Math.max(...xs) - Math.min(...xs)
    const height = Math.max(...ys) - Math.min(...ys)
    expect(width / height).toBeCloseTo(1, 1)
  })

  it('survives a single point (degenerate span) without NaN', () => {
    const { points: proj } = projectTrack([{ lat: 45, lon: 9 }], 100, 100)
    const p = proj[0]
    expect(p).toBeDefined()
    expect(Number.isFinite(p?.x ?? NaN)).toBe(true)
    expect(Number.isFinite(p?.y ?? NaN)).toBe(true)
  })
})
