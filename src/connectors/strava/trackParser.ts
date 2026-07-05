// ─── Track parser ─────────────────────────────────────────────────────────────
//
// Parses the raw per-activity files Strava's export ships alongside
// activities.csv (GPX / TCX, optionally gzipped) into one normalized shape the
// detail page can chart without caring about the source format.
//
// Main-thread parsing is a deliberate choice: exactly one file is parsed,
// lazily, when a detail page opens — typically a few hundred kB of XML that
// DOMParser handles in single-digit milliseconds. A worker would add transfer
// and lifecycle cost for no perceptible gain (the import worker exists because
// it processes the WHOLE zip; this parses one file).
//
// FIT is parsed via @garmin/fitsdk — chosen over fit-file-parser because it is
// the format owner's official SDK (regenerated with every FIT profile release,
// so new Garmin fields never break decoding), fully typed, and it returns
// position fields as RAW semicircles, letting us own the documented
// semicircles × (180 / 2^31) → degrees conversion instead of trusting a
// third-party's unit options. It is loaded with a dynamic import so only
// activities that actually are FIT pay its download cost.
//
// Parse-permissive philosophy (matches the CSV parser): individual bad track
// points are skipped, not fatal; only a structurally unreadable file yields
// kind: 'error'. The page must never crash on a corrupt file.

import { cumulativeDistanceKm } from '@/lib/geo'

// ─── Normalized shape ─────────────────────────────────────────────────────────

export interface TrackPoint {
  lat: number
  lon: number
  /** Elevation in metres, when the file provides it. */
  ele?: number
  /** Unix milliseconds, when the file provides a per-point timestamp. */
  time?: number
  /** Heart rate in bpm — TCX natively, GPX only via the gpxtpx:hr extension. */
  hr?: number
}

export interface ParsedTrack {
  points: TrackPoint[]
  /** Haversine-derived total, km. May differ slightly from the CSV figure. */
  totalDistanceKm: number
  /** Cumulative km per point — precomputed here so charts share one pass. */
  cumulativeKm: number[]
}

// Discriminated union instead of throwing: the page switches on `kind` to pick
// a note/chart, and a thrown error from an async parse is exactly the kind of
// unhandled-rejection crash the spec forbids on bad files.
export type TrackParseResult =
  | { kind: 'track'; track: ParsedTrack }
  | { kind: 'unsupported-gz' } // .gz file but no DecompressionStream (old Safari)
  | { kind: 'unsupported-format' } // extension we don't recognise at all
  | { kind: 'error' } // corrupt / unreadable file
  | { kind: 'empty' } // parsed fine but zero usable points (e.g. treadmill GPX)

// ─── Input caps ───────────────────────────────────────────────────────────────
//
// Defense against a pathological single file (hand-crafted or a gzip bomb —
// the export's .gz files are decompressed in-memory before parsing): without
// caps, one bad file could OOM the whole tab. Real-world scale for reference:
// a 24 h 1 Hz recording is ~86 k points and a few tens of MB of XML, so both
// limits sit far above anything a legitimate activity produces.

/** Max decompressed/raw text or FIT buffer size accepted for parsing (50 MB). */
export const MAX_TRACK_BYTES = 50 * 1024 * 1024

/** Max points kept per track (200 k). Beyond this the track is DOWNSAMPLED
 * with a uniform stride rather than truncated: charts should still show the
 * whole route/effort at reduced resolution, not silently drop its second
 * half. The last point is always kept so total distance stays honest. */
export const MAX_TRACK_POINTS = 200_000

/** Uniform-stride downsample to at most MAX_TRACK_POINTS (see above).
 * Exported for unit tests: driving it through parseGpx would need a 200k-point
 * XML fixture, which is exactly the pathological input we're defending against. */
export function capPoints(points: TrackPoint[]): TrackPoint[] {
  if (points.length <= MAX_TRACK_POINTS) return points
  const stride = Math.ceil(points.length / MAX_TRACK_POINTS)
  const sampled: TrackPoint[] = []
  for (let i = 0; i < points.length; i += stride) {
    const pt = points[i]
    if (pt !== undefined) sampled.push(pt) // undefined is unreachable; satisfies noUncheckedIndexedAccess
  }
  const last = points.at(-1)
  if (last !== undefined && sampled.at(-1) !== last) sampled.push(last)
  return sampled
}

// ─── Format detection ─────────────────────────────────────────────────────────

export interface TrackFormat {
  base: 'gpx' | 'tcx' | 'fit' | 'unknown'
  gzipped: boolean
}

/** Detect format from the CSV Filename (the only signal the export gives us). */
export function detectTrackFormat(fileRef: string): TrackFormat {
  const lower = fileRef.toLowerCase()
  const gzipped = lower.endsWith('.gz')
  const stem = gzipped ? lower.slice(0, -3) : lower
  const base = stem.endsWith('.gpx')
    ? 'gpx'
    : stem.endsWith('.tcx')
      ? 'tcx'
      : stem.endsWith('.fit')
        ? 'fit'
        : 'unknown'
  return { base, gzipped }
}

// ─── XML helpers ──────────────────────────────────────────────────────────────

function parseXml(text: string): Document | null {
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  // DOMParser never throws on bad XML; it embeds a <parsererror> element.
  return doc.getElementsByTagName('parsererror').length > 0 ? null : doc
}

/**
 * Namespace-agnostic descendant lookup. GPX extensions live in vendor
 * namespaces (gpxtpx:, ns3:, …) whose PREFIX varies per recording app, so we
 * match on localName only — the wildcard-namespace form of getElementsByTagNameNS
 * does exactly that.
 */
function firstByLocalName(parent: Element, localName: string): Element | null {
  const list = parent.getElementsByTagNameNS('*', localName)
  return list.length > 0 ? (list.item(0) ?? null) : null
}

function numericText(el: Element | null): number | undefined {
  if (el === null) return undefined
  const n = Number(el.textContent)
  return Number.isFinite(n) ? n : undefined
}

// ─── Per-format parsers ───────────────────────────────────────────────────────

function buildTrack(rawPoints: TrackPoint[]): TrackParseResult {
  if (rawPoints.length === 0) return { kind: 'empty' }
  const points = capPoints(rawPoints)
  const cumulativeKm = cumulativeDistanceKm(points)
  return {
    kind: 'track',
    track: {
      points,
      cumulativeKm,
      totalDistanceKm: cumulativeKm.at(-1) ?? 0,
    },
  }
}

/** GPX: <trkpt lat lon><ele/><time/><extensions>…gpxtpx:hr…</extensions></trkpt> */
export function parseGpx(xmlText: string): TrackParseResult {
  const doc = parseXml(xmlText)
  if (doc === null) return { kind: 'error' }

  const points: TrackPoint[] = []
  const trkpts = doc.getElementsByTagNameNS('*', 'trkpt')
  for (const pt of Array.from(trkpts)) {
    const lat = Number(pt.getAttribute('lat'))
    const lon = Number(pt.getAttribute('lon'))
    // Skip (don't fail on) points without valid coordinates — GPS dropouts
    // produce these in real recordings.
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue

    const point: TrackPoint = { lat, lon }
    const ele = numericText(firstByLocalName(pt, 'ele'))
    if (ele !== undefined) point.ele = ele
    const timeText = firstByLocalName(pt, 'time')?.textContent
    if (timeText) {
      const ms = Date.parse(timeText)
      if (Number.isFinite(ms)) point.time = ms
    }
    // HR is a Garmin TrackPointExtension (gpxtpx:hr) — prefix varies, so the
    // lookup is by localName 'hr' anywhere under the point's <extensions>.
    const hr = numericText(firstByLocalName(pt, 'hr'))
    if (hr !== undefined) point.hr = hr

    points.push(point)
  }
  return buildTrack(points)
}

/** TCX: <Trackpoint><Position><LatitudeDegrees/>…<HeartRateBpm><Value/> */
export function parseTcx(xmlText: string): TrackParseResult {
  const doc = parseXml(xmlText)
  if (doc === null) return { kind: 'error' }

  const points: TrackPoint[] = []
  const trackpoints = doc.getElementsByTagNameNS('*', 'Trackpoint')
  for (const pt of Array.from(trackpoints)) {
    const pos = firstByLocalName(pt, 'Position')
    // TCX writes Trackpoints with no Position during GPS loss — skip those.
    if (pos === null) continue
    const lat = numericText(firstByLocalName(pos, 'LatitudeDegrees'))
    const lon = numericText(firstByLocalName(pos, 'LongitudeDegrees'))
    if (lat === undefined || lon === undefined) continue

    const point: TrackPoint = { lat, lon }
    const ele = numericText(firstByLocalName(pt, 'AltitudeMeters'))
    if (ele !== undefined) point.ele = ele
    const timeText = firstByLocalName(pt, 'Time')?.textContent
    if (timeText) {
      const ms = Date.parse(timeText)
      if (Number.isFinite(ms)) point.time = ms
    }
    const hrEl = firstByLocalName(pt, 'HeartRateBpm')
    const hr = hrEl === null ? undefined : numericText(firstByLocalName(hrEl, 'Value'))
    if (hr !== undefined) point.hr = hr

    points.push(point)
  }
  return buildTrack(points)
}

// ─── FIT ──────────────────────────────────────────────────────────────────────

// FIT stores coordinates as sint32 "semicircles": the full signed 32-bit range
// maps onto ±180°, so degrees = semicircles × (180 / 2^31). This constant IS
// the format spec — the SDK deliberately does not convert position fields.
const SEMICIRCLES_TO_DEGREES = 180 / 2 ** 31

/** FIT: record messages carry timestamp / position / altitude / heart rate. */
export async function parseFit(buffer: ArrayBuffer): Promise<TrackParseResult> {
  // Dynamic import: the SDK (profile tables included) is only fetched when a
  // FIT activity is actually opened — GPX/TCX users never download it.
  const { Decoder, Stream } = await import('@garmin/fitsdk')
  try {
    const stream = Stream.fromArrayBuffer(buffer)
    // Header signature check first: a non-FIT payload (or garbage) is a
    // corrupt file from the user's point of view, not an unsupported format.
    if (!Decoder.isFIT(stream)) return { kind: 'error' }

    const { messages, errors } = new Decoder(stream).read()
    const records = messages.recordMesgs ?? []
    // Parse-permissive: decode errors only become fatal when they left us with
    // no records at all — a partially damaged file still charts what it has.
    if (records.length === 0 && errors.length > 0) return { kind: 'error' }

    const points: TrackPoint[] = []
    for (const r of records) {
      // Records without a position (GPS dropout, indoor stretches) are
      // skipped, mirroring the GPX/TCX parsers.
      if (typeof r.positionLat !== 'number' || typeof r.positionLong !== 'number') continue
      const point: TrackPoint = {
        lat: r.positionLat * SEMICIRCLES_TO_DEGREES,
        lon: r.positionLong * SEMICIRCLES_TO_DEGREES,
      }
      // enhancedAltitude (32-bit) supersedes altitude (16-bit) when present —
      // same field, more range; the SDK has already applied scale/offset.
      const ele = r.enhancedAltitude ?? r.altitude
      if (typeof ele === 'number' && Number.isFinite(ele)) point.ele = ele
      if (r.timestamp instanceof Date) point.time = r.timestamp.getTime()
      if (typeof r.heartRate === 'number') point.hr = r.heartRate
      points.push(point)
    }
    return buildTrack(points)
  } catch {
    // Truncated/CRC-broken FIT — the decoder throws; surface as 'error'.
    return { kind: 'error' }
  }
}

// ─── Blob reading ─────────────────────────────────────────────────────────────
//
// FileReader instead of the newer Blob.text()/.arrayBuffer(): identical
// behaviour in every browser we support, but jsdom (the unit-test DOM) only
// implements the FileReader API — using it keeps the tested code path and the
// shipped code path the same instead of forking on environment.

function readBlobAsText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      resolve(reader.result as string)
    }
    reader.onerror = () => {
      reject(new Error('Blob read failed'))
    }
    reader.readAsText(blob)
  })
}

function readBlobAsArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      resolve(reader.result as ArrayBuffer)
    }
    reader.onerror = () => {
      reject(new Error('Blob read failed'))
    }
    reader.readAsArrayBuffer(blob)
  })
}

// ─── Gzip ─────────────────────────────────────────────────────────────────────

/**
 * Decompress a .gz blob with the native DecompressionStream. Feature-detected
 * because Safari only gained it in 16.4 — callers get 'unsupported-gz' rather
 * than a crash on older engines (no pako dependency: the export's .gz files
 * are the only compressed input, and modern engines all have the native API).
 */
async function gunzipToArrayBuffer(blob: Blob): Promise<ArrayBuffer | null> {
  try {
    // Via ArrayBuffer→Response rather than blob.stream(): identical result in
    // browsers, but it also works under jsdom (whose Blob lacks .stream()),
    // so the unit tests exercise this exact code path.
    const body = new Response(await readBlobAsArrayBuffer(blob)).body
    if (body === null) return null
    const stream = body.pipeThrough(new DecompressionStream('gzip'))
    return await new Response(stream).arrayBuffer()
  } catch {
    // Truncated/corrupt gzip payload — surfaced as a parse error upstream.
    return null
  }
}

async function gunzipToText(blob: Blob): Promise<string | null> {
  const buffer = await gunzipToArrayBuffer(blob)
  return buffer === null ? null : new TextDecoder().decode(buffer)
}

// ─── Entry point ──────────────────────────────────────────────────────────────

/**
 * Parse a stored raw file (as imported into the rawFiles table) into the
 * normalized track shape. Never throws — every failure mode is a result kind.
 */
export async function parseTrackBlob(fileRef: string, blob: Blob): Promise<TrackParseResult> {
  const { base, gzipped } = detectTrackFormat(fileRef)

  if (base === 'unknown') return { kind: 'unsupported-format' }

  try {
    // FIT is binary — it takes the ArrayBuffer path, never the text one.
    if (base === 'fit') {
      let buffer: ArrayBuffer
      if (gzipped) {
        if (typeof DecompressionStream === 'undefined') return { kind: 'unsupported-gz' }
        const decompressed = await gunzipToArrayBuffer(blob)
        if (decompressed === null) return { kind: 'error' }
        buffer = decompressed
      } else {
        buffer = await readBlobAsArrayBuffer(blob)
      }
      // Size cap AFTER decompression — that's where a gzip bomb inflates.
      // Surfaced as 'error': from the user's perspective a 50 MB+ single
      // activity file is not a readable recording.
      if (buffer.byteLength > MAX_TRACK_BYTES) return { kind: 'error' }
      return await parseFit(buffer)
    }

    let text: string
    if (gzipped) {
      if (typeof DecompressionStream === 'undefined') return { kind: 'unsupported-gz' }
      const decompressed = await gunzipToText(blob)
      if (decompressed === null) return { kind: 'error' }
      text = decompressed
    } else {
      text = await readBlobAsText(blob)
    }
    // Same post-decompression cap for the XML formats (UTF-16 code units ≈
    // bytes for GPX/TCX, which are ASCII-dominated markup).
    if (text.length > MAX_TRACK_BYTES) return { kind: 'error' }
    return base === 'gpx' ? parseGpx(text) : parseTcx(text)
  } catch {
    // Blob read failures (e.g. Safari evicted the backing store) land here.
    return { kind: 'error' }
  }
}
