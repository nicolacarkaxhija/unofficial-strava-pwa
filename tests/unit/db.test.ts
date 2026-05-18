import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/db/client'
import type { Activity, RawFile } from '@/db/schema'

// ─── Dexie contract tests ─────────────────────────────────────────────────────
//
// These verify the behaviours the app RELIES on, against fake-indexeddb:
//   • bulkPut is upsert (re-import must not duplicate)
//   • orderBy('date') gives chronological order (ISO strings sort correctly)
//   • sport filtering works in JS over a full read (the type index was
//     dropped in schema v2 — no app query ever used it)
//   • rawFiles round-trips a Blob keyed by filename

function act(id: string, date: string, type = 'Run'): Activity {
  return {
    id,
    date,
    name: `a-${id}`,
    type,
    distanceKm: 5,
    movingTimeSec: 1800,
    elapsedTimeSec: 1900,
    elevationGainM: 10,
    avgHeartRate: null,
    maxHeartRate: null,
    avgWatts: null,
    calories: null,
    fileRef: null,
  }
}

beforeEach(async () => {
  // Each test starts from an empty database — the global IDBFactory reset in
  // tests/setup.ts covers new connections, this covers the module singleton.
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('activities table', () => {
  it('bulkPut upserts by Activity ID — re-import does not duplicate', async () => {
    await db.activities.bulkPut([act('1', '2026-01-01T08:00:00.000Z')])
    const updated = { ...act('1', '2026-01-01T08:00:00.000Z'), name: 'renamed' }
    await db.activities.bulkPut([updated])

    expect(await db.activities.count()).toBe(1)
    expect((await db.activities.get('1'))?.name).toBe('renamed')
  })

  it('orderBy(date).reverse() returns newest first', async () => {
    await db.activities.bulkPut([
      act('old', '2025-05-01T08:00:00.000Z'),
      act('new', '2026-05-01T08:00:00.000Z'),
      act('mid', '2025-11-01T08:00:00.000Z'),
    ])
    const rows = await db.activities.orderBy('date').reverse().toArray()
    expect(rows.map((r) => r.id)).toEqual(['new', 'mid', 'old'])
  })

  it('sport filtering works JS-side after a full read (no type index in v2)', async () => {
    await db.activities.bulkPut([
      act('1', '2026-01-01T08:00:00.000Z', 'Run'),
      act('2', '2026-01-02T08:00:00.000Z', 'Ride'),
      act('3', '2026-01-03T08:00:00.000Z', 'Run'),
    ])
    // Mirrors how every page filters: toArray() then Array.filter — matches
    // the v2 schema decision to drop the never-queried `type` index.
    const runs = (await db.activities.toArray()).filter((a) => a.type === 'Run')
    expect(runs).toHaveLength(2)
  })
})

describe('rawFiles table', () => {
  it('stores and retrieves a Blob keyed by the CSV filename', async () => {
    const raw: RawFile = {
      id: 'activities/123.gpx',
      activityId: '123',
      blob: new Blob(['<gpx/>'], { type: 'application/gpx+xml' }),
    }
    await db.rawFiles.bulkPut([raw])

    const stored = await db.rawFiles.get('activities/123.gpx')
    expect(stored?.activityId).toBe('123')
    // fake-indexeddb's structured clone cannot reproduce a real Blob in jsdom
    // (it comes back as a plain object), so byte-level round-tripping is
    // asserted in the Playwright suite against real IndexedDB. Here we pin the
    // contract that the record and its key survive.
    expect(stored?.blob).toBeDefined()
  })

  it('activityId index locates the raw file for an activity (phase-2 query)', async () => {
    await db.rawFiles.bulkPut([
      { id: 'activities/1.gpx', activityId: '1', blob: new Blob(['a']) },
      { id: 'activities/2.fit.gz', activityId: '2', blob: new Blob(['b']) },
    ])
    const found = await db.rawFiles.where('activityId').equals('2').first()
    expect(found?.id).toBe('activities/2.fit.gz')
  })
})
