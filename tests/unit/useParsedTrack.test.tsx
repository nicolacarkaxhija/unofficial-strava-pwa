import { describe, it, expect } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useParsedTrack } from '@/lib/useParsedTrack'
import { buildGpx, cityLoopPoints } from '../fixtures/trackFiles'
import type { RawFile } from '@/db/schema'

// ─── useParsedTrack ───────────────────────────────────────────────────────────
//
// The hook mirrors the DB three-state contract for an async parse:
//   undefined in  → undefined out (upstream still loading)
//   null in       → null out (resolved: nothing to parse)
//   RawFile in    → undefined (parsing) → TrackParseResult

function makeRawFile(id: string, content: string): RawFile {
  return { id, activityId: '1', blob: new Blob([content]) }
}

describe('useParsedTrack', () => {
  it('passes through undefined (upstream loading)', () => {
    const { result } = renderHook(() => useParsedTrack(undefined))
    expect(result.current).toBeUndefined()
  })

  it('resolves null when there is no raw file', async () => {
    const { result } = renderHook(() => useParsedTrack(null))
    await waitFor(() => {
      expect(result.current).toBeNull()
    })
  })

  it('parses a GPX raw file into a track result', async () => {
    const rawFile = makeRawFile('activities/1.gpx', buildGpx(cityLoopPoints()))
    const { result } = renderHook(() => useParsedTrack(rawFile))
    // Kicks off as undefined (parse in flight)…
    expect(result.current).toBeUndefined()
    // …and resolves to a parsed track.
    await waitFor(() => {
      expect(result.current?.kind).toBe('track')
    })
  })

  it('resolves an error kind (not a throw) for a corrupt file', async () => {
    const rawFile = makeRawFile('activities/1.gpx', '<gpx><broken')
    const { result } = renderHook(() => useParsedTrack(rawFile))
    await waitFor(() => {
      expect(result.current?.kind).toBe('error')
    })
  })

  it('re-parses when the raw file changes (navigation between details)', async () => {
    const gpx = makeRawFile('activities/1.gpx', buildGpx(cityLoopPoints()))
    const fit = makeRawFile('activities/2.fit', 'binary-ish')
    const { result, rerender } = renderHook(({ file }: { file: RawFile }) => useParsedTrack(file), {
      initialProps: { file: gpx },
    })
    await waitFor(() => {
      expect(result.current?.kind).toBe('track')
    })
    rerender({ file: fit })
    await waitFor(() => {
      expect(result.current?.kind).toBe('unsupported-fit')
    })
  })
})
