import { z } from 'zod'

// ─── Strava CSV Row Schema ────────────────────────────────────────────────────
//
// Defines the shape of a SINGLE ROW from Strava's `activities.csv` (GDPR
// account export). Column names are Strava's exact "Title Case" headers.
//
// Why Zod at the CSV row level (not just TypeScript interfaces):
//   CSV parsing produces `Record<string, string>` — every cell is a string.
//   Zod validates AND transforms: `z.coerce.number()` parses "14.2" → 14.2,
//   "" → null. This prevents garbage strings from reaching IndexedDB or the
//   aggregate math.
//
// Design principle: parse permissively, store precisely.
//   - Unknown columns are stripped (`.strip()` behaviour from z.object()) —
//     real exports carry 80+ columns (gear, weather, perceived exertion…);
//     we only pull the ones v1 renders.
//   - Missing optional columns default to null, not undefined
//   - Only "Activity ID" and "Activity Date" are hard requirements; a row
//     without either cannot be stored or sorted and is skipped by the parser.

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Strava writes empty cells for metrics a device didn't record (no HR strap,
// no power meter). `nullableNumber` coerces "14.2" → 14.2 and "" or missing → null.
// Non-numeric garbage (e.g. a shifted column) also becomes null rather than NaN:
// NaN would poison every sum in the aggregates module.
const nullableNumber = z.preprocess((v) => {
  if (v === '' || v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}, z.number().nullable())

// ─── Activity ─────────────────────────────────────────────────────────────────
//
// Header names are kept EXACTLY as Strava writes them so the schema can be
// diffed against a real export at a glance.

export const ActivityRowSchema = z.object({
  'Activity ID': z.string().min(1),
  'Activity Date': z.string().min(1),
  // Name/type can be blank in edge cases (very old imports); default rather
  // than skip — a nameless run is still a run.
  'Activity Name': z.string().catch('').default(''),
  'Activity Type': z.string().catch('').default(''),
  Distance: nullableNumber,
  'Moving Time': nullableNumber,
  'Elapsed Time': nullableNumber,
  'Elevation Gain': nullableNumber,
  'Average Heart Rate': nullableNumber,
  'Max Heart Rate': nullableNumber,
  'Average Watts': nullableNumber,
  Calories: nullableNumber,
  // Filename links the row to its raw GPX/TCX/FIT(.gz) inside the ZIP.
  // Empty string (manual activities have no file) → null.
  Filename: z.preprocess((v) => (v === '' || v == null ? null : v), z.string().nullable()),
})

export type ActivityRow = z.infer<typeof ActivityRowSchema>
