// ─── Synthetic Strava ZIP Builder ─────────────────────────────────────────────
//
// Why we build a real ZIP rather than mocking the worker or the parser:
//
//   The ZIP→Papa.parse→Zod→Dexie pipeline is the highest-risk integration
//   point in the entire app. Every layer can silently corrupt data:
//     • JSZip can misread file entries (encoding, compression, CRC)
//     • Papa Parse can misidentify delimiters or header rows
//     • Zod coercions can silently produce `null` for values we expected
//     • Dexie's bulkPut can drop records when a PK constraint fires
//
//   Mocking any layer would give false confidence. The approach here: produce
//   a Blob that is structurally indistinguishable from what Strava's
//   account-export generates (activities.csv at the root + raw files under
//   activities/), then let the import pipeline process it without stubbing.

import { gzipSync } from 'node:zlib'
import Papa from 'papaparse'
import JSZip from 'jszip'
import { makeActivityRow, type RawActivityRow } from './csvRows'
import { buildFitDummy, buildGpx, buildTcx, cityLoopPoints } from './trackFiles'

export interface FixtureZipOptions {
  /** Number of activities to generate. Default: 60. */
  activities?: number
  /**
   * Number of calendar days the activities are spread over (ending yesterday,
   * evenly spaced). Default: 90 — guarantees several fully-populated ISO weeks
   * so week-over-week deltas exist.
   */
  spanDays?: number
  /**
   * How many of the activities get a REAL .gpx raw file (a small Milan city
   * loop, parsed by the app's actual DOMParser path). The FIRST one carries
   * gpxtpx:hr heart-rate extensions, the rest are HR-free. Default: 3.
   */
  gpxFiles?: number
  /** Activities (after the gpx ones) that get a real .tcx file with HR. Default: 0. */
  tcxFiles?: number
  /** Activities (after tcx) that get a gzipped .gpx.gz file. Default: 0. */
  gzGpxFiles?: number
  /** Activities (after gz) that get a dummy .fit file (unsupported path). Default: 0. */
  fitFiles?: number
  /** Extra raw rows appended verbatim (edge-case injection). */
  extraRows?: RawActivityRow[]
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

// Strava's "Activity Date" is a US-locale datetime string. We format our
// synthetic dates the same way so the fixture exercises the parser's real
// normalisation path, not a convenient ISO shortcut.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function stravaDate(d: Date): string {
  const month = MONTHS[d.getMonth()] ?? 'Jan'
  const h24 = d.getHours()
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  const ampm = h24 < 12 ? 'AM' : 'PM'
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${month} ${String(d.getDate())}, ${String(d.getFullYear())}, ${String(h12)}:${mm}:${ss} ${ampm}`
}

// ─── Row generation ───────────────────────────────────────────────────────────

const SPORTS = ['Run', 'Ride', 'Walk', 'Swim'] as const

// Sequential file-type assignment: activities [0, gpx) get .gpx, then .tcx,
// then .gpx.gz, then .fit. Deterministic so E2E specs can address "the tcx
// activity" by index without reading app state.
interface FileCounts {
  gpx: number
  tcx: number
  gz: number
  fit: number
}

function fileRefFor(i: number, id: string, c: FileCounts): string {
  if (i < c.gpx) return `activities/${id}.gpx`
  if (i < c.gpx + c.tcx) return `activities/${id}.tcx`
  if (i < c.gpx + c.tcx + c.gz) return `activities/${id}.gpx.gz`
  if (i < c.gpx + c.tcx + c.gz + c.fit) return `activities/${id}.fit`
  return ''
}

function buildRows(count: number, spanDays: number, files: FileCounts): RawActivityRow[] {
  const rows: RawActivityRow[] = []
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  yesterday.setHours(7, 30, 0, 0)

  for (let i = 0; i < count; i++) {
    // Newest first (i=0 is yesterday), evenly spaced across the span.
    const d = new Date(yesterday)
    d.setDate(d.getDate() - Math.round((i * spanDays) / count))
    const sport = SPORTS[i % SPORTS.length] ?? 'Run'
    const id = `9${String(100000000 + i)}`
    rows.push(
      makeActivityRow({
        'Activity ID': id,
        'Activity Date': stravaDate(d),
        'Activity Name': `${sport} #${String(i + 1)}`,
        'Activity Type': sport,
        // Vary metrics so aggregates and records have non-constant inputs.
        Distance: (5 + (i % 10) * 1.5).toFixed(2),
        'Moving Time': String(1800 + (i % 10) * 300),
        'Elapsed Time': String(1900 + (i % 10) * 320),
        'Elevation Gain': String(20 + (i % 7) * 30),
        // Swims have no elevation and no HR strap in this fixture — realistic
        // sparsity exercises the ""→null path end-to-end.
        ...(sport === 'Swim'
          ? { 'Elevation Gain': '', 'Average Heart Rate': '', 'Max Heart Rate': '' }
          : {}),
        Filename: fileRefFor(i, id, files),
      }),
    )
  }
  return rows
}

// ─── Raw file content ─────────────────────────────────────────────────────────
//
// Real parseable documents, generated once and reused for every referenced
// file: the tests care about the parse path, not about tracks differing
// between activities. The first .gpx per zip carries HR extensions so exactly
// one fixture activity exercises the gpxtpx:hr path.

const GPX_WITH_HR = buildGpx(cityLoopPoints({ withHr: true }))
const GPX_NO_HR = buildGpx(cityLoopPoints())
const TCX_WITH_HR = buildTcx(cityLoopPoints({ withHr: true }))
const GZ_GPX = gzipSync(GPX_NO_HR)

function rawFileContent(fileRef: string, isFirstGpx: boolean): string | Uint8Array {
  if (fileRef.endsWith('.gpx.gz')) return GZ_GPX
  if (fileRef.endsWith('.gpx')) return isFirstGpx ? GPX_WITH_HR : GPX_NO_HR
  if (fileRef.endsWith('.tcx')) return TCX_WITH_HR
  return buildFitDummy() // .fit
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Build a ZIP Blob that is format-compatible with Strava's account export.
 *
 * The returned Blob can be passed directly to the import pipeline without any
 * modification — activities.csv at the archive root (Papa.unparse guarantees
 * quoting/escaping consistent with what Papa.parse will read back) plus dummy
 * .gpx raw files under activities/ referenced by the CSV's Filename column.
 */
export async function buildFixtureZip(options: FixtureZipOptions = {}): Promise<Blob> {
  const {
    activities = 60,
    spanDays = 90,
    gpxFiles = 3,
    tcxFiles = 0,
    gzGpxFiles = 0,
    fitFiles = 0,
    extraRows = [],
  } = options

  const generated = buildRows(activities, spanDays, {
    gpx: gpxFiles,
    tcx: tcxFiles,
    gz: gzGpxFiles,
    fit: fitFiles,
  })
  const rows = [...generated, ...extraRows]

  const zip = new JSZip()
  zip.file('activities.csv', Papa.unparse(rows))

  // Raw files referenced from the CSV — real parseable tracks since phase 2.
  // Only generated rows get a real file: extraRows are edge-case injections
  // and may deliberately reference files the ZIP lacks.
  let firstGpx = true
  for (const row of generated) {
    const fileRef = row['Filename']
    if (!fileRef) continue
    const isGpx = fileRef.endsWith('.gpx')
    zip.file(fileRef, rawFileContent(fileRef, isGpx && firstGpx))
    if (isGpx) firstGpx = false
  }

  // JSZip generates a real DEFLATE-compressed ZIP binary.
  // `type: 'blob'` gives us the same Blob type the File API returns when a
  // user selects a file from disk — no conversion needed in tests.
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
}
