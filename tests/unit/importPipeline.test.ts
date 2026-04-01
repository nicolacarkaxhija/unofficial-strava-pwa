import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/db/client'
import { importZip } from '@/workers/importCore'
import { buildFixtureZip, makeActivityRow } from '../fixtures'
import type { ImportStats } from '@/db/schema'

// ─── Import pipeline (ZIP → Dexie) ────────────────────────────────────────────
//
// importCore.importZip is the exact function the worker runs — testing it here
// with fake-indexeddb covers JSZip extraction, Papa parsing, Zod coercion and
// the Dexie transaction in one unmocked round trip. Only the postMessage shell
// and the Worker thread itself are left to the Playwright suite.

const noProgress = () => undefined

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('importZip', () => {
  it('imports the default fixture: 60 activities, 3 raw files, stats + zipBlob', async () => {
    const stats = await importZip(await buildFixtureZip(), noProgress)

    expect(stats.activities).toBe(60)
    expect(stats.rawFiles).toBe(3)
    expect(await db.activities.count()).toBe(60)
    expect(await db.rawFiles.count()).toBe(3)

    // Raw file linkage: id is the CSV Filename, activityId points back.
    // (Blob content round-tripping is asserted in E2E — fake-indexeddb's
    // structured clone flattens Blobs to plain objects in jsdom.)
    const raw = await db.rawFiles.toArray()
    for (const r of raw) {
      expect(r.id).toMatch(/^activities\/.+\.gpx$/)
      expect(await db.activities.get(r.activityId ?? '')).toBeDefined()
      expect(r.blob).toBeDefined()
    }

    // Eviction-recovery blob and stats are persisted in meta.
    const zipEntry = await db.meta.get('zipBlob')
    expect(zipEntry?.value).toBeDefined()
    const statsEntry = await db.meta.get('importStats')
    expect((statsEntry?.value as ImportStats).activities).toBe(60)
  })

  it('is idempotent: re-importing the same ZIP does not duplicate rows', async () => {
    const zip = await buildFixtureZip({ activities: 10 })
    await importZip(zip, noProgress)
    await importZip(zip, noProgress)
    expect(await db.activities.count()).toBe(10)
  })

  it('skips malformed rows but keeps the rest', async () => {
    const zip = await buildFixtureZip({
      activities: 5,
      gpxFiles: 0,
      extraRows: [makeActivityRow({ 'Activity ID': '', 'Activity Name': 'broken' })],
    })
    const stats = await importZip(zip, noProgress)
    expect(stats.activities).toBe(5)
  })

  it('tolerates a CSV Filename that the ZIP does not actually contain', async () => {
    const zip = await buildFixtureZip({
      activities: 2,
      gpxFiles: 0,
      extraRows: [makeActivityRow({ 'Activity ID': 'ghost', Filename: 'activities/missing.gpx' })],
    })
    const stats = await importZip(zip, noProgress)
    expect(stats.activities).toBe(3)
    expect(stats.rawFiles).toBe(0)
  })

  it('rejects a ZIP without activities.csv with a descriptive error', async () => {
    const JSZip = (await import('jszip')).default
    const zip = new JSZip()
    zip.file('profile.json', '{}')
    const blob = await zip.generateAsync({ type: 'blob' })

    await expect(importZip(blob, noProgress)).rejects.toThrow(/activities\.csv/)
  })

  it('rejects a non-ZIP blob', async () => {
    await expect(importZip(new Blob(['definitely not a zip']), noProgress)).rejects.toThrow()
  })

  it('reports monotonically ordered progress phases', async () => {
    const pcts: number[] = []
    await importZip(await buildFixtureZip({ activities: 5 }), (_phase, pct) => pcts.push(pct))
    expect(pcts.length).toBeGreaterThan(2)
    expect([...pcts].sort((a, b) => a - b)).toEqual(pcts)
  })
})
