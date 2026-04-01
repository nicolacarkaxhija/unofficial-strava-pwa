// ─── Activity Hooks ───────────────────────────────────────────────────────────
//
// Why useLiveQuery instead of useState + useEffect + db.activities.toArray()?
//
// useLiveQuery subscribes to the underlying Dexie table and automatically
// re-renders the component whenever the table changes — e.g., the moment an
// import completes and bulkPut() lands 2,000 new Activity rows, every component
// using these hooks re-renders with fresh data. With useState/useEffect you
// would need an event bus, a Zustand store action, or an explicit refetch
// trigger to achieve the same thing. useLiveQuery eliminates that entire
// coordination layer: the database IS the state.
//
// Return type: T | undefined
//   undefined signals "query in flight" (first render before IndexedDB responds).
//   Pages should render a loading skeleton while the value is undefined.

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/client'
import type { Activity } from '@/db/schema'

/** Returns the most recent `limit` activities, newest first. */
export function useActivities(limit = 90): Activity[] | undefined {
  return useLiveQuery(
    () => db.activities.orderBy('date').reverse().limit(limit).toArray(),
    // Re-run the query when limit changes (e.g., the user expands the date range).
    [limit],
  )
}

/**
 * Returns every activity, newest first. Used by Dashboard (week buckets need
 * calendar completeness, not a row count) and Trends (records scan the full
 * history). Even a decade of daily training is only ~4,000 rows — well within
 * a single IndexedDB read.
 */
export function useAllActivities(): Activity[] | undefined {
  return useLiveQuery(() => db.activities.orderBy('date').reverse().toArray(), [])
}
