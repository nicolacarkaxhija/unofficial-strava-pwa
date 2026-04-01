import '@testing-library/jest-dom'
import { IDBFactory } from 'fake-indexeddb'
import Dexie from 'dexie'

// ─── IndexedDB isolation ──────────────────────────────────────────────────────
//
// Dexie normally uses the browser's IndexedDB. In Vitest/jsdom, IndexedDB is
// absent. `fake-indexeddb` provides an in-memory implementation.
// We reset it before every test so each test gets a clean database —
// equivalent to `beforeEach(() => db.delete())` but faster and more reliable.
beforeEach(() => {
  Dexie.dependencies.indexedDB = new IDBFactory()
})
