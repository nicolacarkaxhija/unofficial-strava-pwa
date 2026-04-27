import { describe, it, expect } from 'vitest'
import { gzipSync } from 'node:zlib'
import {
  detectTrackFormat,
  parseGpx,
  parseTcx,
  parseTrackBlob,
} from '@/connectors/strava/trackParser'
import { buildGpx, buildTcx, cityLoopPoints } from '../fixtures/trackFiles'

// ─── Format detection ─────────────────────────────────────────────────────────

describe('detectTrackFormat', () => {
  it('detects gpx / tcx / fit including .gz variants, case-insensitively', () => {
    expect(detectTrackFormat('activities/1.gpx')).toEqual({ base: 'gpx', gzipped: false })
    expect(detectTrackFormat('activities/1.GPX')).toEqual({ base: 'gpx', gzipped: false })
    expect(detectTrackFormat('activities/1.gpx.gz')).toEqual({ base: 'gpx', gzipped: true })
    expect(detectTrackFormat('activities/1.tcx')).toEqual({ base: 'tcx', gzipped: false })
    expect(detectTrackFormat('activities/1.tcx.gz')).toEqual({ base: 'tcx', gzipped: true })
    expect(detectTrackFormat('activities/1.fit')).toEqual({ base: 'fit', gzipped: false })
    expect(detectTrackFormat('activities/1.fit.gz')).toEqual({ base: 'fit', gzipped: true })
  })

  it('flags unknown extensions', () => {
    expect(detectTrackFormat('activities/1.kml').base).toBe('unknown')
  })
})

// ─── GPX ──────────────────────────────────────────────────────────────────────

describe('parseGpx', () => {
  it('parses a real fixture loop: points, ele, time, derived totals', () => {
    const result = parseGpx(buildGpx(cityLoopPoints()))
    expect(result.kind).toBe('track')
    if (result.kind !== 'track') return
    const { track } = result
    expect(track.points.length).toBe(41) // 4 sides × 10 + shared start
    const first = track.points[0]
    expect(first?.lat).toBeCloseTo(45.472, 4)
    expect(first?.lon).toBeCloseTo(9.172, 4)
    expect(first?.ele).toBeCloseTo(120, 0)
    expect(first?.time).toBe(Date.parse('2026-01-15T07:30:00Z'))
    // Closed rectangle ~600 m × ~400 m → perimeter ≈ 1.9 km.
    expect(track.totalDistanceKm).toBeGreaterThan(1.5)
    expect(track.totalDistanceKm).toBeLessThan(2.5)
    expect(track.cumulativeKm).toHaveLength(track.points.length)
    expect(track.cumulativeKm[0]).toBe(0)
  })

  it('reads heart rate from the gpxtpx:hr extension when present', () => {
    const result = parseGpx(buildGpx(cityLoopPoints({ withHr: true })))
    expect(result.kind).toBe('track')
    if (result.kind !== 'track') return
    expect(result.track.points[0]?.hr).toBe(120)
    expect(result.track.points.at(-1)?.hr).toBe(160)
  })

  it('leaves hr undefined for HR-free GPX', () => {
    const result = parseGpx(buildGpx(cityLoopPoints()))
    if (result.kind !== 'track') throw new Error('expected track')
    expect(result.track.points.every((p) => p.hr === undefined)).toBe(true)
  })

  it('returns error for corrupt XML', () => {
    expect(parseGpx('<gpx><trk><trkseg><trkpt lat="1"').kind).toBe('error')
    expect(parseGpx('not xml at all').kind).toBe('error')
  })

  it('returns empty for a GPX with no track points (e.g. treadmill export)', () => {
    const empty = '<?xml version="1.0"?><gpx version="1.1" creator="x"><trk></trk></gpx>'
    expect(parseGpx(empty).kind).toBe('empty')
  })

  it('skips individual points with invalid coordinates instead of failing', () => {
    const xml = `<?xml version="1.0"?><gpx version="1.1"><trk><trkseg>
      <trkpt lat="45.0" lon="9.0"><ele>100</ele></trkpt>
      <trkpt lat="garbage" lon="9.1"><ele>101</ele></trkpt>
      <trkpt lat="45.1" lon="9.1"><ele>102</ele></trkpt>
    </trkseg></trk></gpx>`
    const result = parseGpx(xml)
    if (result.kind !== 'track') throw new Error('expected track')
    expect(result.track.points).toHaveLength(2)
  })

  it('a single-point track parses with zero total distance', () => {
    const xml = `<?xml version="1.0"?><gpx version="1.1"><trk><trkseg>
      <trkpt lat="45.0" lon="9.0"></trkpt>
    </trkseg></trk></gpx>`
    const result = parseGpx(xml)
    if (result.kind !== 'track') throw new Error('expected track')
    expect(result.track.points).toHaveLength(1)
    expect(result.track.totalDistanceKm).toBe(0)
  })
})

// ─── TCX ──────────────────────────────────────────────────────────────────────

describe('parseTcx', () => {
  it('parses a real fixture loop with HR from HeartRateBpm/Value', () => {
    const result = parseTcx(buildTcx(cityLoopPoints({ withHr: true })))
    expect(result.kind).toBe('track')
    if (result.kind !== 'track') return
    const { track } = result
    expect(track.points.length).toBe(41)
    expect(track.points[0]?.hr).toBe(120)
    expect(track.points[0]?.ele).toBeCloseTo(120, 0)
    expect(track.totalDistanceKm).toBeGreaterThan(1.5)
    expect(track.totalDistanceKm).toBeLessThan(2.5)
  })

  it('skips Trackpoints without a Position (GPS dropouts)', () => {
    const xml = `<?xml version="1.0"?><TrainingCenterDatabase><Activities><Activity><Lap><Track>
      <Trackpoint><Time>2026-01-15T07:30:00Z</Time></Trackpoint>
      <Trackpoint><Time>2026-01-15T07:30:05Z</Time><Position><LatitudeDegrees>45</LatitudeDegrees><LongitudeDegrees>9</LongitudeDegrees></Position></Trackpoint>
    </Track></Lap></Activity></Activities></TrainingCenterDatabase>`
    const result = parseTcx(xml)
    if (result.kind !== 'track') throw new Error('expected track')
    expect(result.track.points).toHaveLength(1)
  })

  it('returns error for corrupt XML', () => {
    expect(parseTcx('<TrainingCenterDatabase><Activities>').kind).toBe('error')
  })
})

// ─── parseTrackBlob (entry point) ─────────────────────────────────────────────

describe('parseTrackBlob', () => {
  it('parses a plain .gpx blob end to end', async () => {
    const blob = new Blob([buildGpx(cityLoopPoints())], { type: 'application/gpx+xml' })
    const result = await parseTrackBlob('activities/1.gpx', blob)
    expect(result.kind).toBe('track')
  })

  it('decompresses and parses a .gpx.gz blob via DecompressionStream', async () => {
    const gz = gzipSync(buildGpx(cityLoopPoints({ withHr: true })))
    const blob = new Blob([new Uint8Array(gz)])
    const result = await parseTrackBlob('activities/1.gpx.gz', blob)
    expect(result.kind).toBe('track')
    if (result.kind !== 'track') return
    expect(result.track.points[0]?.hr).toBe(120)
  })

  it('returns error (not a crash) for a corrupt .gz payload', async () => {
    const blob = new Blob(['definitely not gzip bytes'])
    const result = await parseTrackBlob('activities/1.gpx.gz', blob)
    expect(result.kind).toBe('error')
  })

  it('routes .fit and .fit.gz to unsupported-fit without touching the blob', async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])])
    expect((await parseTrackBlob('activities/1.fit', blob)).kind).toBe('unsupported-fit')
    expect((await parseTrackBlob('activities/1.fit.gz', blob)).kind).toBe('unsupported-fit')
  })

  it('flags unknown extensions as unsupported-format', async () => {
    const blob = new Blob(['<kml/>'])
    expect((await parseTrackBlob('activities/1.kml', blob)).kind).toBe('unsupported-format')
  })

  it('returns error for a corrupt XML blob', async () => {
    const blob = new Blob(['<gpx><trkpt'])
    expect((await parseTrackBlob('activities/1.gpx', blob)).kind).toBe('error')
  })
})
