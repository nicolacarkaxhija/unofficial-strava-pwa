// ─── Database Schema ──────────────────────────────────────────────────────────
//
// These TypeScript interfaces are the single source of truth for what is stored
// in IndexedDB. They mirror the Strava GDPR account-export `activities.csv`
// columns (the import parses only that file; raw per-activity files are
// stored as opaque blobs and parsed lazily by the detail page's trackParser).
//
// Naming convention: camelCase here, Strava's exact "Title Case" headers in the
// raw CSV. The parser in src/connectors/strava/parsers/ handles the mapping.
//
// All numeric fields are `number | null` rather than `number | undefined`.
// Dexie stores `undefined` as absent, making queries unreliable. `null`
// explicitly signals "Strava provided this field but it had no value".

// ─── Activity ─────────────────────────────────────────────────────────────────

export interface Activity {
  id: string // PK: CSV "Activity ID"
  date: string // ISO 8601 datetime derived from "Activity Date"; indexed for range queries
  name: string // "Activity Name"
  type: string // "Activity Type" — 'Run' | 'Ride' | 'Walk' | ... (open set, indexed)
  distanceKm: number | null // "Distance" (km)
  movingTimeSec: number | null // "Moving Time" (seconds)
  elapsedTimeSec: number | null // "Elapsed Time" (seconds)
  elevationGainM: number | null // "Elevation Gain" (metres)
  avgHeartRate: number | null // "Average Heart Rate" (bpm)
  maxHeartRate: number | null // "Max Heart Rate" (bpm)
  avgWatts: number | null // "Average Watts"
  calories: number | null // "Calories"
  fileRef: string | null // "Filename" — path of the raw GPX/TCX/FIT inside the export ZIP
}

// ─── Raw files ────────────────────────────────────────────────────────────────
//
// The import STORES GPX/TCX/FIT(.gz) tracks unparsed; the activity detail page
// parses one lazily via connectors/strava/trackParser when it opens. Keeping
// the raw bytes means new parser capabilities never require a re-upload.

export interface RawFile {
  id: string // PK: filename as written in the CSV "Filename" column (e.g. "activities/123.gpx")
  activityId: string | null // FK to Activity.id — linkage comes from the CSV row that referenced the file
  blob: Blob // the raw, still-compressed-if-.gz file bytes
}

// ─── Meta ─────────────────────────────────────────────────────────────────────

// The meta table stores singleton values keyed by a string.
// Current keys:
//   'zipBlob'     → Blob (the original Strava export ZIP, kept for Safari eviction recovery)
//   'importStats' → ImportStats object

export interface MetaEntry {
  key: string
  value: unknown
}

export interface ImportStats {
  activities: number
  rawFiles: number
  importedAt: string // ISO 8601
}
