// ─── Activity detail hooks ────────────────────────────────────────────────────
//
// Three-state contract shared with the rest of the hook layer:
//   undefined → query in flight (first render) → page shows skeletons
//   null      → query RESOLVED and found nothing → page shows the NoData state
//   value     → render it
//
// Collapsing null into undefined was a shipped bug in the sibling template
// (unknown ids showed eternal skeletons); keeping the states distinct is what
// lets an unknown /activities/$id resolve to a real "not found" screen.

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/client'
import type { Activity, RawFile } from '@/db/schema'

/** One activity by id. */
export function useActivity(id: string): Activity | null | undefined {
  return useLiveQuery(
    // Dexie's get() resolves undefined for a missing key — map it to null so
    // "resolved, not found" stays distinguishable from "still loading".
    async () => (await db.activities.get(id)) ?? null,
    [id],
  )
}

/** The stored raw track file for a fileRef (rawFiles PK is the CSV Filename). */
export function useRawFile(fileRef: string | null): RawFile | null | undefined {
  return useLiveQuery(async () => {
    // A null fileRef (manual activity) is a resolved "no file", not a load.
    if (fileRef === null) return null
    return (await db.rawFiles.get(fileRef)) ?? null
  }, [fileRef])
}
