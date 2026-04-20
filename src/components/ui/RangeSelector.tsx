import { useTranslation } from 'react-i18next'

// ─── RangeSelector ────────────────────────────────────────────────────────────
//
// Segmented control for the history window, in CALENDAR DAYS back from today
// (training data reads as "last 30 days", unlike the Oura sibling's row
// counts). ALL_DAYS is a sentinel wide enough for any real archive (~27 y).

export const ALL_DAYS = 10_000

export const RANGE_OPTIONS = [
  { labelKey: 'range.30d', days: 30 },
  { labelKey: 'range.90d', days: 90 },
  { labelKey: 'range.1y', days: 365 },
  { labelKey: 'range.all', days: ALL_DAYS },
] as const

interface RangeSelectorProps {
  value: number
  onChange: (days: number) => void
}

export function RangeSelector({ value, onChange }: RangeSelectorProps) {
  const { t } = useTranslation('common')
  return (
    <div className="mb-4 flex gap-2" role="group" aria-label={t('range.label')}>
      {RANGE_OPTIONS.map(({ labelKey, days }) => (
        <button
          key={days}
          type="button"
          aria-pressed={value === days}
          onClick={() => {
            onChange(days)
          }}
          className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            value === days
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
          }`}
        >
          {t(labelKey)}
        </button>
      ))}
    </div>
  )
}
