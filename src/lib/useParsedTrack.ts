// ─── useParsedTrack ───────────────────────────────────────────────────────────
//
// Bridges the async track parser into React state with the same three-state
// contract as the DB hooks:
//   undefined → parse in flight → skeleton
//   null      → nothing to parse (no fileRef / no stored blob)
//   result    → TrackParseResult (which itself may be an error/unsupported kind)
//
// A hook (not a useEffect inline in the page) so the parse-lifecycle logic is
// unit-testable with renderHook and the page stays declarative.

import { useEffect, useState } from 'react'
import { parseTrackBlob } from '@/connectors/strava/trackParser'
import type { TrackParseResult } from '@/connectors/strava/trackParser'
import type { RawFile } from '@/db/schema'

export function useParsedTrack(
  rawFile: RawFile | null | undefined,
): TrackParseResult | null | undefined {
  // State stores the result KEYED BY the file it was parsed from. Deriving
  // "parsing vs done" from that key (instead of resetting state synchronously
  // in the effect) avoids the setState-in-effect cascade the react-hooks rule
  // forbids, and makes a stale result for a previous file unrepresentable.
  const [done, setDone] = useState<{ file: RawFile; result: TrackParseResult } | null>(null)

  useEffect(() => {
    // Nothing to parse while upstream is loading (undefined) or absent (null).
    if (rawFile === undefined || rawFile === null) return

    // Cancellation flag: if the user navigates between details faster than a
    // parse completes, a stale resolution must not clobber the newer one.
    let cancelled = false
    void parseTrackBlob(rawFile.id, rawFile.blob).then((result) => {
      if (!cancelled) setDone({ file: rawFile, result })
    })
    return () => {
      cancelled = true
    }
  }, [rawFile])

  // Propagate the upstream three-state contract.
  if (rawFile === undefined) return undefined
  if (rawFile === null) return null
  // A result for a DIFFERENT file means this one is still parsing.
  return done !== null && done.file === rawFile ? done.result : undefined
}
