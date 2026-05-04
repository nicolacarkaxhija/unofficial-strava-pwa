import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { db } from '@/db/client'
import { useActivity, useRawFile } from '@/db/hooks'
import type { Activity } from '@/db/schema'

// ─── useActivity / useRawFile ─────────────────────────────────────────────────
//
// The load-bearing distinction under test: a MISSING record resolves to null,
// never stays undefined — that difference is what lets the detail page show a
// real "not found" state instead of eternal skeletons for an unknown id.

const activity: Activity = {
  id: '123',
  date: '2026-01-15T07:30:00.000Z',
  name: 'Morning Run',
  type: 'Run',
  distanceKm: 7.4,
  movingTimeSec: 2310,
  elapsedTimeSec: 2400,
  elevationGainM: 58,
  avgHeartRate: 152,
  maxHeartRate: 178,
  avgWatts: null,
  calories: 512,
  fileRef: 'activities/123.gpx',
}

beforeEach(async () => {
  await db.activities.put(activity)
  await db.rawFiles.put({ id: 'activities/123.gpx', activityId: '123', blob: new Blob(['x']) })
})

describe('useActivity', () => {
  it('resolves the activity for a known id', async () => {
    const { result } = renderHook(() => useActivity('123'))
    await waitFor(() => {
      expect(result.current?.name).toBe('Morning Run')
    })
  })

  it('resolves null (not undefined) for an unknown id', async () => {
    const { result } = renderHook(() => useActivity('nope'))
    await waitFor(() => {
      expect(result.current).toBeNull()
    })
  })
})

describe('useRawFile', () => {
  it('resolves the stored blob row for a fileRef', async () => {
    const { result } = renderHook(() => useRawFile('activities/123.gpx'))
    await waitFor(() => {
      expect(result.current?.activityId).toBe('123')
    })
  })

  it('resolves null for a fileRef the ZIP never contained', async () => {
    const { result } = renderHook(() => useRawFile('activities/ghost.gpx'))
    await waitFor(() => {
      expect(result.current).toBeNull()
    })
  })

  it('resolves null immediately for a null fileRef (manual activity)', async () => {
    const { result } = renderHook(() => useRawFile(null))
    await waitFor(() => {
      expect(result.current).toBeNull()
    })
  })
})
