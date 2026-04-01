import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ProgressBar } from '@/components/ui'
import { runImport } from '@/workers/runImport'

// ─── Onboarding ───────────────────────────────────────────────────────────────
//
// Rendered by App.tsx when useHasData() returns false (no data in IndexedDB).
// Responsibility: explain how to get the account export from Strava and handle
// the ZIP import via a Web Worker.
//
// Worker lifecycle: a fresh worker per import attempt, terminated on settle
// (see runImport). There is no practical scenario where the user imports twice
// within the same page lifetime without navigating away.
//
// After a successful import, useHasData() in App.tsx becomes true → React
// re-renders the root → Onboarding unmounts and the normal app shell appears.
// No imperative navigation is needed; the reactive DB state drives everything.

export default function Onboarding() {
  const { t } = useTranslation('onboarding')

  // Import state machine: idle → importing → done / error
  const [importing, setImporting] = useState(false)
  const [pct, setPct] = useState(0)
  const [phase, setPhase] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Safari eviction: show a banner when the 'no-zip' event fires
  const [evicted, setEvicted] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Listen for the eviction event dispatched by App.tsx's checkAndRepair()
  useEffect(() => {
    function handleEviction(e: Event) {
      const evt = e as CustomEvent<string>
      if (evt.detail === 'no-zip') setEvicted(true)
    }
    window.addEventListener('strava:eviction', handleEviction)
    return () => {
      window.removeEventListener('strava:eviction', handleEviction)
    }
  }, [])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setImporting(true)
    setPct(0)
    setPhase('')
    setError(null)
    setEvicted(false)

    runImport(file, ({ pct: p, phase: ph }) => {
      setPct(p)
      if (ph) setPhase(ph)
    })
      .then(() => {
        // useLiveQuery in App.tsx detects the new data and replaces this
        // component. Resetting importing is a safety net for imports that
        // leave hasData false (e.g. a ZIP whose activities.csv is empty) —
        // without it the progress bar would stick at ~96% forever.
        setImporting(false)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Unknown error')
        setImporting(false)
      })
  }

  const steps = ['step1', 'step2', 'step3', 'step4', 'step5', 'step6'] as const

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 py-12 dark:bg-slate-900">
      {/* Eviction banner — shown when Safari wiped IndexedDB and there's no ZIP */}
      {evicted && (
        <div
          className="mb-6 w-full max-w-md rounded-xl bg-amber-100 px-4 py-3 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-200"
          role="alert"
        >
          {t('eviction.noZip')}
        </div>
      )}

      {/* Logo placeholder + headline */}
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        {/* Circular logo placeholder — replaced when a real SVG asset is added */}
        <div
          className="flex h-20 w-20 items-center justify-center rounded-full bg-orange-500 text-3xl font-bold text-white"
          aria-hidden="true"
        >
          S
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('title')}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">{t('subtitle')}</p>
      </div>

      {/* Step-by-step import instructions */}
      <div className="mb-8 w-full max-w-md rounded-2xl bg-white p-6 shadow-sm dark:bg-slate-800">
        <h2 className="mb-4 text-base font-semibold text-slate-900 dark:text-white">
          {t('steps.heading')}
        </h2>
        <ol className="space-y-3">
          {steps.map((key, idx) => (
            <li
              key={key}
              className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300"
            >
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-700 dark:bg-orange-900/40 dark:text-orange-300"
                aria-hidden="true"
              >
                {idx + 1}
              </span>
              {t(`steps.${key}`)}
            </li>
          ))}
        </ol>
      </div>

      {/* Import button / progress */}
      <div className="w-full max-w-md space-y-4">
        {importing ? (
          <ProgressBar pct={pct} label={phase || t('importBtn')} />
        ) : (
          <>
            {/* Hidden native file input — triggered by the styled button below.
                We hide the input rather than style it because cross-browser
                file-input styling is unreliable and the button UX is cleaner. */}
            <input
              ref={fileInputRef}
              id="zip-input"
              data-testid="zip-input"
              type="file"
              accept=".zip"
              className="sr-only"
              /* The visible button below is the interactive control; keep the
                 hidden input out of the tab order and a11y tree so there aren't
                 two controls named "Import ZIP". */
              tabIndex={-1}
              aria-hidden="true"
              onChange={handleFileChange}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full rounded-2xl bg-orange-500 py-3 text-base font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80"
            >
              {t('importBtn')}
            </button>
          </>
        )}

        {error && (
          <p className="text-center text-sm text-rose-500 dark:text-rose-400" role="alert">
            {error}
          </p>
        )}

        <p className="text-center text-xs text-slate-400 dark:text-slate-500">{t('legal')}</p>
      </div>
    </div>
  )
}
