import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { runImport, MAX_ZIP_BYTES } from '@/workers/runImport'

// ─── runImport concurrency lock ───────────────────────────────────────────────
//
// The Worker itself is stubbed: what's under test here is the module-level
// in-flight lock (Safari-eviction recovery racing a user import must coalesce
// into ONE worker run), plus the size guard — not the ZIP pipeline, which
// importPipeline.test.ts covers via importCore.

class FakeWorker {
  static instances: FakeWorker[] = []
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  posted: unknown[] = []
  terminated = false

  constructor() {
    FakeWorker.instances.push(this)
  }
  postMessage(msg: unknown) {
    this.posted.push(msg)
  }
  terminate() {
    this.terminated = true
  }
  // Test helper: emit a message the way the real worker would.
  emit(data: unknown) {
    this.onmessage?.({ data } as MessageEvent)
  }
}

beforeEach(() => {
  FakeWorker.instances = []
  vi.stubGlobal('Worker', FakeWorker)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const smallBlob = () => new Blob(['zip-bytes'])

// Indexed access under noUncheckedIndexedAccess — throw instead of asserting.
function worker(i: number): FakeWorker {
  const inst = FakeWorker.instances[i]
  if (inst === undefined) throw new Error(`no worker at index ${String(i)}`)
  return inst
}

describe('runImport', () => {
  it('rejects oversized files without spawning a worker', async () => {
    // Fake .size via a plain object cast — building a real 200 MB Blob in
    // jsdom would be slow for no extra confidence.
    const huge = { size: MAX_ZIP_BYTES + 1 } as Blob
    await expect(runImport(huge)).rejects.toThrow(/too large/i)
    expect(FakeWorker.instances).toHaveLength(0)
  })

  it('coalesces a second call while an import is in flight into one worker run', async () => {
    const first = runImport(smallBlob())
    const second = runImport(smallBlob())

    // One worker, and both callers share the same settled outcome.
    expect(FakeWorker.instances).toHaveLength(1)
    worker(0).emit({ type: 'done' })
    await expect(first).resolves.toBeUndefined()
    await expect(second).resolves.toBeUndefined()
    expect(worker(0).terminated).toBe(true)
  })

  it('releases the lock after success so a later import starts a fresh worker', async () => {
    const first = runImport(smallBlob())
    worker(0).emit({ type: 'done' })
    await first

    const second = runImport(smallBlob())
    expect(FakeWorker.instances).toHaveLength(2)
    worker(1).emit({ type: 'done' })
    await second
  })

  it('releases the lock after failure so a retry is possible', async () => {
    const first = runImport(smallBlob())
    worker(0).emit({ type: 'error', payload: { message: 'corrupt zip' } })
    await expect(first).rejects.toThrow('corrupt zip')

    const retry = runImport(smallBlob())
    expect(FakeWorker.instances).toHaveLength(2)
    worker(1).emit({ type: 'done' })
    await expect(retry).resolves.toBeUndefined()
  })

  it('forwards progress messages to the first caller', async () => {
    const seen: { pct: number; phase: string }[] = []
    const p = runImport(smallBlob(), (prog) => seen.push(prog))
    worker(0).emit({ type: 'progress', payload: { pct: 40, phase: 'Extracting…' } })
    worker(0).emit({ type: 'done' })
    await p
    expect(seen).toEqual([{ pct: 40, phase: 'Extracting…' }])
  })
})
