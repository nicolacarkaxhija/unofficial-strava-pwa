// ─── Track file fixtures ──────────────────────────────────────────────────────
//
// REAL (small) GPX and TCX documents — not dummy stubs — so unit and E2E tests
// exercise the actual DOMParser parse path: namespaces, extensions, per-point
// children. Coordinates trace a plausible ~2 km rectangular loop around
// Parco Sempione in Milan (45.47N 9.17E), so haversine totals, the projection
// and the elevation profile all get realistic non-degenerate inputs.

export interface FixtureTrackPoint {
  lat: number
  lon: number
  ele: number
  /** ISO timestamp */
  time: string
  hr?: number
}

export interface LoopOptions {
  /** Points per loop side (4 sides). Default 10 → 41 points. */
  pointsPerSide?: number
  /** Include heart-rate values. Default false. */
  withHr?: boolean
  /** Start time. Default a fixed 2026 morning for deterministic assertions. */
  startIso?: string
}

/**
 * A closed rectangular loop: start and end coincide, so the fixture also
 * exercises the "start dot ≈ end dot" case the RouteMap must survive.
 */
export function cityLoopPoints(options: LoopOptions = {}): FixtureTrackPoint[] {
  const { pointsPerSide = 10, withHr = false, startIso = '2026-01-15T07:30:00Z' } = options

  // Corners of a ~600 m × ~400 m rectangle in Parco Sempione.
  const corners = [
    { lat: 45.472, lon: 9.172 },
    { lat: 45.4756, lon: 9.172 },
    { lat: 45.4756, lon: 9.179 },
    { lat: 45.472, lon: 9.179 },
    { lat: 45.472, lon: 9.172 }, // back to start — closed loop
  ]

  const startMs = Date.parse(startIso)
  const points: FixtureTrackPoint[] = []
  let idx = 0
  for (let side = 0; side < corners.length - 1; side++) {
    const a = corners[side]
    const b = corners[side + 1]
    if (!a || !b) continue
    // Skip t=0 on all but the first side so shared corners aren't duplicated.
    for (let i = side === 0 ? 0 : 1; i <= pointsPerSide; i++) {
      const t = i / pointsPerSide
      const point: FixtureTrackPoint = {
        lat: a.lat + (b.lat - a.lat) * t,
        lon: a.lon + (b.lon - a.lon) * t,
        // A gentle hill: elevation rises then falls across the loop.
        ele: 120 + 15 * Math.sin((idx / (pointsPerSide * 4)) * Math.PI),
        time: new Date(startMs + idx * 5000).toISOString(), // 5 s cadence
      }
      if (withHr) {
        // Plausible warm-up curve: 120 → ~160 bpm.
        point.hr = Math.round(120 + 40 * Math.min(1, idx / 20))
      }
      points.push(point)
      idx++
    }
  }
  return points
}

// ─── GPX ──────────────────────────────────────────────────────────────────────

/**
 * GPX 1.1 with the Garmin TrackPointExtension namespace when HR is present —
 * the exact structure Strava's own exports use for HR-in-GPX, so the parser's
 * namespace-agnostic gpxtpx:hr lookup gets a faithful test.
 */
export function buildGpx(points: FixtureTrackPoint[]): string {
  const trkpts = points
    .map((p) => {
      const hr =
        p.hr !== undefined
          ? `<extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>${String(p.hr)}</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions>`
          : ''
      return `<trkpt lat="${String(p.lat)}" lon="${String(p.lon)}"><ele>${p.ele.toFixed(1)}</ele><time>${p.time}</time>${hr}</trkpt>`
    })
    .join('\n      ')

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="fixture"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">
  <trk>
    <name>Fixture loop</name>
    <trkseg>
      ${trkpts}
    </trkseg>
  </trk>
</gpx>
`
}

// ─── TCX ──────────────────────────────────────────────────────────────────────

/** TCX (Garmin TrainingCenterDatabase) — HR lives in HeartRateBpm/Value. */
export function buildTcx(points: FixtureTrackPoint[]): string {
  const trackpoints = points
    .map((p) => {
      const hr =
        p.hr !== undefined ? `<HeartRateBpm><Value>${String(p.hr)}</Value></HeartRateBpm>` : ''
      return `<Trackpoint><Time>${p.time}</Time><Position><LatitudeDegrees>${String(p.lat)}</LatitudeDegrees><LongitudeDegrees>${String(p.lon)}</LongitudeDegrees></Position><AltitudeMeters>${p.ele.toFixed(1)}</AltitudeMeters>${hr}</Trackpoint>`
    })
    .join('\n          ')

  return `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
  <Activities>
    <Activity Sport="Running">
      <Id>${points[0]?.time ?? '2026-01-15T07:30:00Z'}</Id>
      <Lap StartTime="${points[0]?.time ?? '2026-01-15T07:30:00Z'}">
        <Track>
          ${trackpoints}
        </Track>
      </Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>
`
}

// ─── FIT dummy ────────────────────────────────────────────────────────────────

/**
 * A few bytes with FIT's ".FIT" signature at offset 8. The app never parses
 * FIT — this exists purely to exercise the "unsupported" path with a payload
 * that is at least shaped like the real thing's header.
 */
export function buildFitDummy(): Uint8Array {
  return new Uint8Array([14, 16, 92, 8, 0, 0, 0, 0, 0x2e, 0x46, 0x49, 0x54, 0, 0])
}
