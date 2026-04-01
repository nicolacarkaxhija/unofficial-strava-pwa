import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/db/client'
import { buildExportPayload } from '@/lib/exportData'
import type { Activity } from '@/db/schema'

// ─── Export payload ───────────────────────────────────────────────────────────
//
// The JSON export is the data-ownership exit door. These tests pin the
// contract: activities included verbatim, blobs (meta.zipBlob, rawFiles)
// excluded, and the whole payload JSON-serialisable.

const sample: Activity = {
  id: '42',
  date: '2026-03-01T09:00:00.000Z',
  name: 'Long Ride',
  type: 'Ride',
  distanceKm: 80.5,
  movingTimeSec: 10800,
  elapsedTimeSec: 11200,
  elevationGainM: 900,
  avgHeartRate: 140,
  maxHeartRate: 172,
  avgWatts: 185,
  calories: 2100,
  fileRef: 'activities/42.fit.gz',
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('buildExportPayload', () => {
  it('includes format marker, version and ISO timestamp', async () => {
    const payload = await buildExportPayload()
    expect(payload.format).toBe('unofficial-strava-pwa')
    expect(payload.version).toBe(1)
    expect(new Date(payload.exportedAt).toString()).not.toBe('Invalid Date')
  })

  it('exports activities verbatim, including nulls', async () => {
    await db.activities.put({ ...sample, avgWatts: null })
    const payload = await buildExportPayload()
    expect(payload.tables['activities']).toHaveLength(1)
    expect(payload.tables['activities']?.[0]).toMatchObject({ id: '42', avgWatts: null })
  })

  it('excludes rawFiles and meta (blobs are not JSON-serialisable)', async () => {
    await db.rawFiles.put({ id: 'activities/x.gpx', activityId: '42', blob: new Blob(['x']) })
    await db.meta.put({ key: 'zipBlob', value: new Blob(['zip']) })

    const payload = await buildExportPayload()
    expect(Object.keys(payload.tables)).toEqual(['activities'])
  })

  it('round-trips through JSON.stringify without loss', async () => {
    await db.activities.put(sample)
    const payload = await buildExportPayload()
    const revived = JSON.parse(JSON.stringify(payload)) as typeof payload
    expect(revived.tables['activities']).toEqual(payload.tables['activities'])
  })
})
