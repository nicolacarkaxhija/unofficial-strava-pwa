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

import Papa from 'papaparse'
import JSZip from 'jszip'
import { makeActivityRow, type RawActivityRow } from './csvRows'

export interface FixtureZipOptions {
  /** Number of activities to generate. Default: 60. */
  activities?: number
  /**
   * Number of calendar days the activities are spread over (ending yesterday,
   * evenly spaced). Default: 90 — guarantees several fully-populated ISO weeks
   * so week-over-week deltas exist.
   */
  spanDays?: number
  /** How many of the activities get a dummy .gpx raw file in the ZIP. Default: 3. */
  gpxFiles?: number
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

function buildRows(count: number, spanDays: number, gpxFiles: number): RawActivityRow[] {
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
        Filename: i < gpxFiles ? `activities/${id}.gpx` : '',
      }),
    )
  }
  return rows
}

const DUMMY_GPX =
  '<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="fixture"><trk><name>fixture</name></trk></gpx>\n'

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
  const { activities = 60, spanDays = 90, gpxFiles = 3, extraRows = [] } = options

  const generated = buildRows(activities, spanDays, gpxFiles)
  const rows = [...generated, ...extraRows]

  const zip = new JSZip()
  zip.file('activities.csv', Papa.unparse(rows))

  // Raw files referenced from the CSV — stored, never parsed, in v1.
  // Only generated rows get a real file: extraRows are edge-case injections
  // and may deliberately reference files the ZIP lacks.
  for (const row of generated) {
    const fileRef = row['Filename']
    if (fileRef) zip.file(fileRef, DUMMY_GPX)
  }

  // JSZip generates a real DEFLATE-compressed ZIP binary.
  // `type: 'blob'` gives us the same Blob type the File API returns when a
  // user selects a file from disk — no conversion needed in tests.
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
}
