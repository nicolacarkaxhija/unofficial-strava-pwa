// ─── DB Hooks Barrel ──────────────────────────────────────────────────────────
//
// Single import point for all Dexie reactive hooks.
// Usage: import { useActivities, useHasData } from '@/db/hooks'
//
// Each domain module keeps its hooks co-located with its query logic;
// this barrel exists solely for ergonomic imports in page components.

export { useActivities, useAllActivities } from './useActivities'
export { useImportStats, useHasData } from './useMeta'
