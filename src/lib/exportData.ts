import { db } from '@/db/client'

// ─── Data export ──────────────────────────────────────────────────────────────
//
// Dumps the activities table to a single JSON blob. Closes the data-ownership
// loop: what came in via GDPR export can leave again in a machine-readable
// form — after the user's own filtering horizon, not Strava's.
//
// meta and rawFiles are deliberately excluded: meta's only large entry is the
// raw ZIP blob kept for Safari eviction recovery (not serialisable to JSON and
// redundant — the user already has the ZIP), rawFiles are binary blobs the
// user likewise already owns inside that same ZIP, and importStats is derivable.

export interface ExportPayload {
  format: 'unofficial-strava-pwa'
  /** Bump when the table shapes change incompatibly. */
  version: 1
  exportedAt: string
  tables: Record<string, unknown[]>
}

export async function buildExportPayload(): Promise<ExportPayload> {
  const activities = await db.activities.toArray()

  return {
    format: 'unofficial-strava-pwa',
    version: 1,
    exportedAt: new Date().toISOString(),
    tables: { activities },
  }
}

/** Serialise the payload and hand it to the browser as a file download. */
export async function downloadExport(): Promise<void> {
  const payload = await buildExportPayload()
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = `strava-data-${payload.exportedAt.slice(0, 10)}.json`
    a.click()
  } finally {
    // Deferred revoke: some browsers cancel the download if the URL is
    // revoked synchronously before the click is processed.
    setTimeout(() => {
      URL.revokeObjectURL(url)
    }, 10_000)
  }
}
