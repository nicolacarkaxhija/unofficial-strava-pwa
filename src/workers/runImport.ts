// ─── runImport ────────────────────────────────────────────────────────────────
//
// Single entry point for running the ZIP import worker. Extracted so the three
// call sites — Onboarding (first import), Settings (re-import), and App's
// Safari-eviction recovery (silent reparse of the stored blob) — share one
// worker lifecycle instead of three divergent copies.
//
// A fresh worker is spawned per call and always terminated on settle; there is
// no import scenario where reusing a worker across attempts buys anything, and
// a fresh worker guarantees a failed attempt can't poison the next one.

interface WorkerMessage {
  type: 'progress' | 'done' | 'error'
  payload?: {
    pct?: number
    phase?: string
    message?: string
  }
}

export interface ImportProgress {
  pct: number
  phase: string
}

// Hard cap on the accepted file size. Strava exports can be large (years of
// GPX), but 200 MB already assumes an extreme archive. The cap exists to fail
// fast on wrong-file mistakes and zip bombs instead of letting JSZip OOM the
// worker.
export const MAX_ZIP_BYTES = 200 * 1024 * 1024

// Module-level in-flight lock. Two call sites can legitimately race: App's
// Safari-eviction recovery fires on mount while the user may simultaneously
// start a manual (re-)import. Each import clears the tables before writing,
// so two concurrent runs interleave clears and bulkPuts — the last transaction
// wins but progress UIs and importStats can end up describing the loser.
// Coalescing (returning the in-flight promise) beats queueing: both racers
// import the same account export, so running it twice buys nothing. The
// second caller's onProgress is not attached — the silent recovery path
// passes none, and a user-visible import that joins a recovery run still
// resolves/rejects correctly, which is what the UI state machine keys on.
let inFlight: Promise<void> | null = null

export function runImport(blob: Blob, onProgress?: (p: ImportProgress) => void): Promise<void> {
  if (blob.size > MAX_ZIP_BYTES) {
    return Promise.reject(
      new Error(`File too large (${String(Math.round(blob.size / 1024 / 1024))} MB, max 200 MB)`),
    )
  }

  if (inFlight !== null) return inFlight

  const run = new Promise<void>((resolve, reject) => {
    const worker = new Worker(new URL('./import.worker.ts', import.meta.url), {
      type: 'module',
    })

    const settle = (fn: () => void) => {
      worker.terminate()
      fn()
    }

    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const { type, payload } = event.data
      if (type === 'progress') {
        onProgress?.({ pct: payload?.pct ?? 0, phase: payload?.phase ?? '' })
      } else if (type === 'done') {
        settle(resolve)
      } else {
        settle(() => {
          reject(new Error(payload?.message ?? 'Unknown import error'))
        })
      }
    }

    worker.onerror = (err) => {
      settle(() => {
        reject(new Error(err.message))
      })
    }

    worker.postMessage({ type: 'start', payload: { blob } })
  })

  // Release the lock on settle (success OR failure) so the next import —
  // e.g. a retry after a corrupt-file error — can start a fresh worker.
  inFlight = run.finally(() => {
    inFlight = null
  })
  return inFlight
}
