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
// FIT is intentionally NOT parsed: it is a binary format that would require a
// dependency (or a hand-rolled binary reader) for a file type most exports
// don't even contain unless the athlete records on a Garmin. Until a user asks,
// the page shows an i18n'd "not yet supported" note instead. (Documented
// decision — revisit when requested.)
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
  | { kind: 'unsupported-fit' } // .fit / .fit.gz — see decision note above
  | { kind: 'unsupported-gz' } // .gz file but no DecompressionStream (old Safari)
  | { kind: 'unsupported-format' } // extension we don't recognise at all
  | { kind: 'error' } // corrupt / unreadable file
  | { kind: 'empty' } // parsed fine but zero usable points (e.g. treadmill GPX)

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

function buildTrack(points: TrackPoint[]): TrackParseResult {
  if (points.length === 0) return { kind: 'empty' }
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
async function gunzipToText(blob: Blob): Promise<string | null> {
  try {
    // Via ArrayBuffer→Response rather than blob.stream(): identical result in
    // browsers, but it also works under jsdom (whose Blob lacks .stream()),
    // so the unit tests exercise this exact code path.
    const body = new Response(await readBlobAsArrayBuffer(blob)).body
    if (body === null) return null
    const stream = body.pipeThrough(new DecompressionStream('gzip'))
    return await new Response(stream).text()
  } catch {
    // Truncated/corrupt gzip payload — surfaced as a parse error upstream.
    return null
  }
}

// ─── Entry point ──────────────────────────────────────────────────────────────

/**
 * Parse a stored raw file (as imported into the rawFiles table) into the
 * normalized track shape. Never throws — every failure mode is a result kind.
 */
export async function parseTrackBlob(fileRef: string, blob: Blob): Promise<TrackParseResult> {
  const { base, gzipped } = detectTrackFormat(fileRef)

  if (base === 'fit') return { kind: 'unsupported-fit' }
  if (base === 'unknown') return { kind: 'unsupported-format' }

  try {
    let text: string
    if (gzipped) {
      if (typeof DecompressionStream === 'undefined') return { kind: 'unsupported-gz' }
      const decompressed = await gunzipToText(blob)
      if (decompressed === null) return { kind: 'error' }
      text = decompressed
    } else {
      text = await readBlobAsText(blob)
    }
    return base === 'gpx' ? parseGpx(text) : parseTcx(text)
  } catch {
    // Blob read failures (e.g. Safari evicted the backing store) land here.
    return { kind: 'error' }
  }
}
