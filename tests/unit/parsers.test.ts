import { describe, it, expect } from 'vitest'
import Papa from 'papaparse'
import { parseActivities } from '@/connectors/strava/parsers'
import { makeActivityRow } from '../fixtures'

// ─── parseActivities ──────────────────────────────────────────────────────────
//
// The parser receives Papa.parse output (Record<string, string>[]) and must be
// permissive: skip unparseable rows, coerce "" → null, tolerate unknown and
// missing columns. Some tests go through Papa.parse on raw CSV text so the
// CRLF/quoting behaviour of the real pipeline is covered, not just the Zod step.

describe('parseActivities', () => {
  it('parses a fully populated row into a typed Activity', () => {
    const [a] = parseActivities([makeActivityRow()])
    expect(a).toBeDefined()
    expect(a?.id).toBe('10012345678')
    expect(a?.name).toBe('Morning Run')
    expect(a?.type).toBe('Run')
    expect(a?.distanceKm).toBe(7.42)
    expect(a?.movingTimeSec).toBe(2310)
    expect(a?.elapsedTimeSec).toBe(2400)
    expect(a?.elevationGainM).toBe(58)
    expect(a?.avgHeartRate).toBe(152)
    expect(a?.maxHeartRate).toBe(178)
    expect(a?.calories).toBe(512)
    expect(a?.fileRef).toBe('activities/10012345678.gpx')
  })

  it('normalises the US-locale Activity Date to ISO 8601', () => {
    const [a] = parseActivities([makeActivityRow({ 'Activity Date': 'Jul 4, 2025, 6:12:35 AM' })])
    expect(a?.date).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    expect(new Date(a?.date ?? '').getFullYear()).toBe(2025)
  })

  it('accepts an already-ISO Activity Date', () => {
    const [a] = parseActivities([makeActivityRow({ 'Activity Date': '2024-03-01T10:00:00Z' })])
    expect(a?.date).toBe('2024-03-01T10:00:00.000Z')
  })

  it('coerces empty-string numerics to null (no-HR, no-power activities)', () => {
    const [a] = parseActivities([
      makeActivityRow({
        Distance: '',
        'Average Heart Rate': '',
        'Average Watts': '',
        Calories: '',
      }),
    ])
    expect(a?.distanceKm).toBeNull()
    expect(a?.avgHeartRate).toBeNull()
    expect(a?.avgWatts).toBeNull()
    expect(a?.calories).toBeNull()
  })

  it('coerces non-numeric garbage to null instead of NaN', () => {
    // NaN would silently poison every weekly sum downstream.
    const [a] = parseActivities([makeActivityRow({ Distance: 'not-a-number' })])
    expect(a?.distanceKm).toBeNull()
  })

  it('maps empty Filename to null (manual activities have no raw file)', () => {
    const [a] = parseActivities([makeActivityRow({ Filename: '' })])
    expect(a?.fileRef).toBeNull()
  })

  it('skips rows without an Activity ID', () => {
    const result = parseActivities([makeActivityRow({ 'Activity ID': '' }), makeActivityRow()])
    expect(result).toHaveLength(1)
  })

  it('skips rows with an unparseable Activity Date', () => {
    const result = parseActivities([
      makeActivityRow({ 'Activity Date': 'not a date' }),
      makeActivityRow(),
    ])
    expect(result).toHaveLength(1)
  })

  it('tolerates extra unknown columns (real exports carry 80+)', () => {
    const [a] = parseActivities([
      { ...makeActivityRow(), 'Perceived Exertion': '7', 'Bike Weight': '9.2' },
    ])
    expect(a).toBeDefined()
  })

  it('tolerates missing optional columns entirely', () => {
    // Older exports lack columns like Average Watts — absence must behave like "".
    const row = makeActivityRow()
    delete (row as Record<string, string | undefined>)['Average Watts']
    delete (row as Record<string, string | undefined>)['Calories']
    const [a] = parseActivities([row])
    expect(a?.avgWatts).toBeNull()
    expect(a?.calories).toBeNull()
  })

  it('returns [] for empty input and for a rows array of garbage', () => {
    expect(parseActivities([])).toEqual([])
    expect(parseActivities([null, 42, 'nope'])).toEqual([])
  })

  // ── Through Papa.parse: raw-CSV edge cases ────────────────────────────────

  function parseCsvText(text: string) {
    return Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true }).data
  }

  it('handles CRLF line endings without corrupting the last column', () => {
    const csv =
      'Activity ID,Activity Date,Activity Name,Activity Type,Distance\r\n' +
      '123,"Jan 15, 2026, 7:30:12 AM",Morning Run,Run,7.42\r\n'
    const [a] = parseActivities(parseCsvText(csv))
    expect(a?.id).toBe('123')
    expect(a?.distanceKm).toBe(7.42)
  })

  it('handles quoted fields containing commas and escaped quotes', () => {
    const csv =
      'Activity ID,Activity Date,Activity Name,Activity Type,Distance\n' +
      '124,"Jan 15, 2026, 7:30:12 AM","Lunch ""tempo"" run, hot day",Run,5.0\n'
    const [a] = parseActivities(parseCsvText(csv))
    expect(a?.name).toBe('Lunch "tempo" run, hot day')
  })

  it('parses an empty CSV (headers only) to zero activities', () => {
    const csv = 'Activity ID,Activity Date,Activity Name\n'
    expect(parseActivities(parseCsvText(csv))).toEqual([])
  })

  it('parses a completely malformed text blob to zero activities', () => {
    expect(parseActivities(parseCsvText('%%% not a csv at all'))).toEqual([])
  })
})
