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

// ─── FIT ──────────────────────────────────────────────────────────────────────
//
// A REAL, minimal FIT binary hand-built to the FIT Protocol spec — not a stub:
// 14-byte header (".FIT" signature + header CRC), one little-endian definition
// message for the `record` global message (num 20) with timestamp / lat / lon /
// altitude / heart-rate fields, one data message per point, and the trailing
// file CRC-16. @garmin/fitsdk decodes it exactly like a watch recording, so
// tests exercise the true decode path (CRC checks, semicircles, alt scaling).

/** CRC-16 as defined in the FIT Protocol (nibble-table variant from the spec). */
function fitCrc16(bytes: Uint8Array): number {
  const table = [
    0x0000, 0xcc01, 0xd801, 0x1400, 0xf001, 0x3c00, 0x2800, 0xe401, 0xa001, 0x6c00, 0x7800,
    0xb401, 0x5000, 0x9c01, 0x8801, 0x4400,
  ]
  let crc = 0
  for (const byte of bytes) {
    let tmp = table[crc & 0xf] ?? 0
    crc = (crc >> 4) & 0x0fff
    crc = crc ^ tmp ^ (table[byte & 0xf] ?? 0)
    tmp = table[crc & 0xf] ?? 0
    crc = (crc >> 4) & 0x0fff
    crc = crc ^ tmp ^ (table[(byte >> 4) & 0xf] ?? 0)
  }
  return crc
}

// FIT timestamps count seconds from the FIT epoch, 1989-12-31T00:00:00Z.
const FIT_EPOCH_S = Date.UTC(1989, 11, 31) / 1000
// FIT's sint32 invalid sentinel — what a device writes on GPS dropout.
const FIT_SINT32_INVALID = 0x7fffffff

export interface BuildFitOptions {
  /** Append a record whose position is the invalid sentinel (GPS dropout). */
  withInvalidPositionRecord?: boolean
}

/** Build valid FIT bytes containing one `record` message per point. */
export function buildFit(points: FixtureTrackPoint[], options: BuildFitOptions = {}): Uint8Array {
  const RECORD_SIZE = 1 + 4 + 4 + 4 + 2 + 1 // header + ts + lat + lon + alt + hr
  const extra = options.withInvalidPositionRecord ? 1 : 0

  // Definition message: local type 0 → global message 20 (record), LE.
  // Field triplets after the count are (field def number, size, base type).
  // prettier-ignore
  const definition = Uint8Array.from([
    0x40, 0x00, 0x00, 20, 0x00, 5,
    253, 4, 0x86, // timestamp: uint32
    0, 4, 0x85,   // position_lat: sint32 (semicircles)
    1, 4, 0x85,   // position_long: sint32 (semicircles)
    2, 2, 0x84,   // altitude: uint16, scale 5 offset 500 (per FIT profile)
    3, 1, 0x02,   // heart_rate: uint8
  ])

  const data = new Uint8Array(definition.length + (points.length + extra) * RECORD_SIZE)
  data.set(definition, 0)
  const view = new DataView(data.buffer)
  let o = definition.length
  const writeRecord = (lat: number, lon: number, ele: number, timeMs: number, hr?: number) => {
    view.setUint8(o, 0x00) // data message, local type 0
    view.setUint32(o + 1, Math.round(timeMs / 1000 - FIT_EPOCH_S), true)
    view.setInt32(o + 5, lat, true)
    view.setInt32(o + 9, lon, true)
    // Profile altitude encoding: stored = (metres + 500) × 5.
    view.setUint16(o + 13, Math.round((ele + 500) * 5), true)
    view.setUint8(o + 15, hr ?? 0xff) // 0xff = uint8 invalid → "no HR"
    o += RECORD_SIZE
  }
  const toSemicircles = (deg: number) => Math.round((deg * 2 ** 31) / 180)
  for (const p of points) {
    writeRecord(toSemicircles(p.lat), toSemicircles(p.lon), p.ele, Date.parse(p.time), p.hr)
  }
  if (options.withInvalidPositionRecord) {
    writeRecord(FIT_SINT32_INVALID, FIT_SINT32_INVALID, 0, Date.parse('2026-01-15T08:00:00Z'))
  }

  // 14-byte header: size, protocol 1.0, profile version, data size, ".FIT", CRC.
  const header = new Uint8Array(14)
  const hv = new DataView(header.buffer)
  hv.setUint8(0, 14)
  hv.setUint8(1, 0x10)
  hv.setUint16(2, 2120, true) // profile version — informational only
  hv.setUint32(4, data.length, true)
  header.set([0x2e, 0x46, 0x49, 0x54], 8) // ".FIT"
  hv.setUint16(12, fitCrc16(header.subarray(0, 12)), true)

  const withoutCrc = new Uint8Array(header.length + data.length)
  withoutCrc.set(header, 0)
  withoutCrc.set(data, header.length)

  const out = new Uint8Array(withoutCrc.length + 2)
  out.set(withoutCrc, 0)
  new DataView(out.buffer).setUint16(withoutCrc.length, fitCrc16(withoutCrc), true)
  return out
}
