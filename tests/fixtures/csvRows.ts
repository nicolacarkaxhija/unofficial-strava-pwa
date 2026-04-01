// ─── CSV Row Factories ────────────────────────────────────────────────────────
//
// Each factory returns a plain `Record<string, string>` — exactly what Papa
// Parse produces from a real Strava activities.csv before any Zod coercion.
// Every value is a string because CSV has no native types.
//
// Why plain objects rather than typed Zod outputs?
//   The test subject is the parse pipeline itself. Giving it pre-coerced data
//   would test nothing. These factories produce the raw string records that
//   land on the parser's doorstep after `Papa.parse(...).data` — the same
//   shape the import worker will hand to `parseActivities()`.
//
// Overrides let individual tests inject edge-case values (empty strings for
// null coercion, garbage numbers, missing optional columns, etc.) without
// duplicating the full default record in each test file.
//
// Header names are Strava's documented `activities.csv` headers, verbatim.

export type RawRecord = Record<string, string>

export type RawActivityRow = RawRecord

export function makeActivityRow(overrides?: Partial<RawActivityRow>): RawActivityRow {
  return {
    'Activity ID': '10012345678',
    // Strava writes a US-locale datetime; keeping the realistic format here
    // ensures the parser's Date.parse normalisation is what the tests exercise.
    'Activity Date': 'Jan 15, 2026, 7:30:12 AM',
    'Activity Name': 'Morning Run',
    'Activity Type': 'Run',
    'Elapsed Time': '2400',
    Distance: '7.42',
    'Moving Time': '2310',
    'Elevation Gain': '58',
    'Average Heart Rate': '152',
    'Max Heart Rate': '178',
    'Average Watts': '',
    Calories: '512',
    Filename: 'activities/10012345678.gpx',
    ...overrides,
  }
}
