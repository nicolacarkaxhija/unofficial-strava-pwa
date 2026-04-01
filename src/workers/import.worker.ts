// ─── ZIP Import Worker ────────────────────────────────────────────────────────
//
// Why a Worker instead of running this on the main thread?
//   JSZip decompression + Papa Parse CSV parsing is CPU-bound and can block
//   the main thread for seconds on a multi-hundred-MB Strava export (raw GPX
//   files add up fast). Offloading to a Worker keeps the UI responsive — the
//   user sees live progress updates instead of a frozen browser tab.
//
// The actual pipeline lives in importCore.ts so the unit suite can exercise it
// directly; this file is only the postMessage protocol shell.
//
// This is a native Vite module Worker — Vite bundles it as a separate chunk
// (no extra config needed) when the main thread instantiates it with:
//   new Worker(new URL('./workers/import.worker.ts', import.meta.url), { type: 'module' })

import { importZip } from './importCore'
import type { ImportStats } from '../db/schema'

// ─── Message Protocol ─────────────────────────────────────────────────────────

export type WorkerInMessage = { type: 'start'; payload: { blob: Blob } }

export type WorkerOutMessage =
  | { type: 'progress'; payload: { phase: string; pct: number } }
  | { type: 'done'; payload: { stats: ImportStats } }
  | { type: 'error'; payload: { message: string } }

function post(msg: WorkerOutMessage) {
  self.postMessage(msg)
}

// ─── Entry point ──────────────────────────────────────────────────────────────

self.onmessage = (event: MessageEvent<WorkerInMessage>) => {
  const msg = event.data
  // WorkerInMessage only has type 'start', so no dispatch needed — go directly.

  importZip(msg.payload.blob, (phase, pct) => {
    post({ type: 'progress', payload: { phase, pct } })
  })
    .then((stats) => {
      post({ type: 'done', payload: { stats } })
    })
    .catch((e: unknown) => {
      // Catch and report errors rather than letting them propagate unhandled.
      //
      // Why not re-throw?
      //   An unhandled Worker error fires `onerror` on the main thread but gives
      //   no structured payload — the user sees nothing. Posting a typed 'error'
      //   message lets the UI surface a human-readable failure reason.
      const message = e instanceof Error ? e.message : String(e)
      post({ type: 'error', payload: { message } })
    })
}
