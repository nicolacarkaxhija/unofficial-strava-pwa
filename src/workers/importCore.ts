// ─── Import core ──────────────────────────────────────────────────────────────
//
// The ZIP → CSV → Zod → Dexie pipeline, extracted from the worker so the unit
// suite can exercise the exact code the worker runs (with fake-indexeddb)
// instead of a re-implementation that silently diverges. The worker file is a
// thin postMessage shell around this function.
//
// Source-agnostic by design: the only input is a Blob. Note that Strava
// OAuth/API sync was evaluated and permanently DECLINED for legal reasons
// (Strava's API agreement forbids replacement-client use) — the GDPR export
// ZIP is the only data source this app will ever have.

import JSZip from 'jszip'
import Papa from 'papaparse'
import { db } from '../db/client'
import type { Activity, RawFile, ImportStats } from '../db/schema'
import { parseActivities } from '../connectors/strava/parsers'

export interface ProgressFn {
  (phase: string, pct: number): void
}

/** Parse CSV text into an array of raw row objects via Papa Parse.
 *
 * Why `worker: false`?
 *   Papa Parse can spawn its own worker for large CSVs, but this code already
 *   runs inside a Worker. Nesting workers is not supported in all browsers and
 *   would silently produce no output in Safari. Sync parsing inside a Worker
 *   is the right approach — we own the thread, so blocking it is acceptable.
 */
function parseCsv(text: string): Record<string, string>[] {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    worker: false, // must be false — cannot nest workers inside a Worker
    skipEmptyLines: true,
  })
  return result.data
}

/** Find `activities.csv` anywhere in the archive.
 *
 * Strava's export puts it at the root, but users sometimes re-zip the
 * extracted folder — then every entry gains a directory prefix. Matching on
 * the filename part accepts both layouts.
 */
function findActivitiesCsv(zip: JSZip): JSZip.JSZipObject | null {
  return (
    Object.values(zip.files).find(
      (f) => !f.dir && (f.name === 'activities.csv' || f.name.endsWith('/activities.csv')),
    ) ?? null
  )
}

/** Resolve a CSV "Filename" reference (e.g. "activities/123.gpx.gz") to a ZIP
 * entry, tolerating the same re-zip directory-prefix drift as the CSV lookup. */
function findRawFile(zip: JSZip, fileRef: string): JSZip.JSZipObject | null {
  return (
    Object.values(zip.files).find(
      (f) => !f.dir && (f.name === fileRef || f.name.endsWith(`/${fileRef}`)),
    ) ?? null
  )
}

export async function importZip(blob: Blob, onProgress: ProgressFn): Promise<ImportStats> {
  // Step 1: Open the ZIP archive
  onProgress('Opening ZIP…', 2)
  const zip = await JSZip.loadAsync(blob)

  // Step 2: Parse activities.csv — the only file v1 understands.
  onProgress('Parsing activities.csv…', 10)
  const csvEntry = findActivitiesCsv(zip)
  if (csvEntry === null) {
    // A ZIP without activities.csv is not a Strava export — loud failure beats
    // silently importing zero activities and stranding the user on Onboarding.
    throw new Error('activities.csv not found — is this a Strava account export?')
  }
  const activities: Activity[] = parseActivities(parseCsv(await csvEntry.async('string')))

  // Step 3: Collect raw per-activity files (GPX/TCX/FIT, possibly .gz).
  // Deliberately not parsed HERE — stored as opaque blobs; the detail page
  // parses exactly one lazily via connectors/strava/trackParser when opened.
  // Parsing thousands of tracks up front would multiply import time for files
  // most users never open. Only files referenced by a CSV row are stored:
  // unreferenced archive entries (media, profile.json…) are out of scope.
  onProgress('Extracting activity files…', 40)
  const rawFiles: RawFile[] = []
  for (const activity of activities) {
    if (activity.fileRef === null) continue
    const entry = findRawFile(zip, activity.fileRef)
    if (entry === null) continue // CSV references a file the ZIP lacks — tolerate
    rawFiles.push({
      id: activity.fileRef,
      activityId: activity.id,
      blob: await entry.async('blob'),
    })
  }

  // Step 4: Batch-write in a single transaction.
  //
  // Replace, don't merge: each import clears activities/rawFiles first.
  //   An export IS the complete account history, so upsert-only semantics
  //   would leave stale rows behind when re-importing a smaller export (or a
  //   different account's). Clearing inside the transaction keeps it atomic —
  //   a failed import rolls back to the previous data, never an empty DB.
  //
  // Why a single transaction wrapping all tables?
  //   Atomicity — either every table is updated or none is (on error, IndexedDB
  //   rolls back the whole write). The user never ends up with partial data.
  onProgress('Writing to database…', 80)
  await db.transaction('rw', [db.activities, db.rawFiles, db.meta], async () => {
    await db.activities.clear()
    await db.rawFiles.clear()
    await Promise.all([db.activities.bulkPut(activities), db.rawFiles.bulkPut(rawFiles)])

    // Store the original ZIP blob for Safari eviction recovery.
    //
    // Why keep the ZIP?
    //   Safari's ITP policy aggressively evicts IndexedDB storage after 7 days
    //   of inactivity. By caching the raw ZIP blob alongside the parsed data,
    //   we can re-run the import automatically if the DB is cleared, without
    //   asking the user to re-upload their file.
    await db.meta.put({ key: 'zipBlob', value: blob })
  })

  // Step 5: Compute and persist import statistics.
  onProgress('Finalising…', 96)
  const stats: ImportStats = {
    activities: activities.length,
    rawFiles: rawFiles.length,
    importedAt: new Date().toISOString(),
  }
  await db.meta.put({ key: 'importStats', value: stats })

  return stats
}
