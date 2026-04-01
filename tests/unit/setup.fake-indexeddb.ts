// ─── Global fake-indexeddb registration ──────────────────────────────────────
//
// Why this exists in addition to tests/setup.ts's per-test IDBFactory reset:
// the `db` singleton in src/db/client.ts is constructed at module-import time,
// and Dexie captures its IndexedDB dependency at construction — before any
// beforeEach hook runs. Without a global `indexedDB` present when the module
// graph loads, Dexie throws MissingAPIError on first use, no matter what the
// beforeEach later assigns to Dexie.dependencies.
//
// 'fake-indexeddb/auto' installs indexedDB + IDBKeyRange on globalThis before
// test-file imports are evaluated (setup files run first), so the singleton
// binds to the fake implementation. Test isolation is then achieved by the
// test files clearing tables in their own beforeEach — each Vitest worker has
// its own module graph, so files never share a database instance.
import 'fake-indexeddb/auto'
