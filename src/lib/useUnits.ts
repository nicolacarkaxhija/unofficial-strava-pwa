import { useSyncExternalStore } from 'react'
import { getStoredUnits, setStoredUnits, UNITS_EVENT, type Units } from './units'

// ─── useUnits ─────────────────────────────────────────────────────────────────
//
// Why useSyncExternalStore instead of a context provider?
//   The store is localStorage — it already exists and outlives React. A
//   provider would only re-wrap that external state in React state, adding a
//   Provider component and a re-render of the whole tree on change. With
//   useSyncExternalStore, only components that actually call useUnits()
//   re-render, and the subscription (a window event) is torn down automatically.

function subscribe(callback: () => void): () => void {
  window.addEventListener(UNITS_EVENT, callback)
  return () => {
    window.removeEventListener(UNITS_EVENT, callback)
  }
}

export function useUnits(): { units: Units; setUnits: (u: Units) => void } {
  const units = useSyncExternalStore(subscribe, getStoredUnits)
  return { units, setUnits: setStoredUnits }
}
