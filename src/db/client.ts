import Dexie, { type Table } from 'dexie'
import type { Activity, RawFile, MetaEntry } from './schema'

// ─── StravaPWA Database ───────────────────────────────────────────────────────
//
// Why Dexie over raw IndexedDB:
//   1. Promise-based API instead of event callbacks
//   2. `useLiveQuery` hook — components subscribe to queries and re-render
//      automatically when records change, replacing an entire state layer
//   3. `bulkPut` for upsert semantics — re-importing a ZIP updates records
//      in place rather than duplicating them
//
// Schema version notes:
//   Only indexed fields appear in `stores()`. Every other field is stored
//   inside the object but cannot be queried directly — that's fine because
//   we query by id (PK), by date (ordering) or by type (sport filter).
//   Non-indexed fields are accessed via .get() or .toArray() and filtered in JS.
//
//   When adding a new index: increment the version number and add a new
//   `db.version(N).stores({...})` block. Never modify version 1's schema —
//   this would break existing users' databases.

class StravaPWADatabase extends Dexie {
  activities!: Table<Activity, string>
  rawFiles!: Table<RawFile, string>
  meta!: Table<MetaEntry, string>

  constructor() {
    super('StravaPWA')

    this.version(1).stores({
      // Primary key first; remaining comma-separated values are indexes.
      // date: orderBy('date') powers every list/aggregate query.
      // type: sport-filter chips on the Activities page.
      activities: 'id, date, type',
      // rawFiles: PK is the CSV Filename; activityId index lets phase 2 find
      // the raw track for a given activity without a full-table scan.
      rawFiles: 'id, activityId',
      meta: 'key',
    })

    // v2: drop the `type` index. Every sport filter in the app reads the full
    // table via useAllActivities() and filters in JS (the chips need a full
    // type census anyway), so the index was pure write/storage overhead that
    // was never queried. Dexie deletes an index when it disappears from the
    // stores() spec of a newer version — data is untouched.
    this.version(2).stores({
      activities: 'id, date',
    })
  }
}

// Singleton export — import `db` everywhere; never instantiate StravaPWADatabase
// directly. Dexie manages the connection lifecycle.
export const db = new StravaPWADatabase()
