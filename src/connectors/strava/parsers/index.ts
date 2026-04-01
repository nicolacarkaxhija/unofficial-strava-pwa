import { ActivityRowSchema } from '../schema'
import type { Activity } from '@/db/schema'

// ─── Parser strategy: skip-and-warn, never throw ──────────────────────────────
//
// Why skip bad rows instead of aborting the entire import?
//   1. Partial data is far more useful than no data. A user importing 10 years
//      of activity history shouldn't lose everything because one row has a
//      corrupt cell from an old device upload.
//   2. Strava's export format has drifted over the years (columns added,
//      duplicated, localised). Permissive parsing accepts old exports without
//      crashing.
//   3. The Zod schema is the validation gate — if a row passes `.safeParse`
//      it is safe to store. If it doesn't, logging the index lets developers
//      identify systematic issues without interrupting the user's import flow.

// ─── Date normalisation ───────────────────────────────────────────────────────
//
// Strava writes "Activity Date" in a US-locale text format, e.g.
// "Jul 4, 2025, 6:12:35 AM". JS Date.parse handles that format (and ISO 8601,
// which some older exports use) natively in every engine we target. We
// normalise to ISO 8601 so string ordering === chronological ordering — the
// Dexie `date` index relies on that for orderBy('date').
//
// Returns null (row skipped) when the date is unparseable: an activity that
// cannot be placed in time cannot appear in any week bucket or list.
function toIsoDate(raw: string): string | null {
  const ms = Date.parse(raw)
  if (Number.isNaN(ms)) return null
  return new Date(ms).toISOString()
}

// ─── parseActivities ──────────────────────────────────────────────────────────

export function parseActivities(rows: unknown[]): Activity[] {
  const results: Activity[] = []

  for (let i = 0; i < rows.length; i++) {
    const result = ActivityRowSchema.safeParse(rows[i])
    if (!result.success) {
      console.warn(`[parseActivities] Skipping row ${String(i)}: ${result.error.message}`)
      continue
    }
    const r = result.data

    const date = toIsoDate(r['Activity Date'])
    if (date === null) {
      console.warn(`[parseActivities] Skipping row ${String(i)}: unparseable date`)
      continue
    }

    results.push({
      id: r['Activity ID'],
      date,
      name: r['Activity Name'],
      type: r['Activity Type'],
      distanceKm: r.Distance,
      movingTimeSec: r['Moving Time'],
      elapsedTimeSec: r['Elapsed Time'],
      elevationGainM: r['Elevation Gain'],
      avgHeartRate: r['Average Heart Rate'],
      maxHeartRate: r['Max Heart Rate'],
      avgWatts: r['Average Watts'],
      calories: r.Calories,
      fileRef: r.Filename,
    })
  }

  return results
}
