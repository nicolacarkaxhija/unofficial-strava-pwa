import { useTranslation } from 'react-i18next'

// ─── RangeSelector ────────────────────────────────────────────────────────────
//
// Segmented control for the list pages' history window. Values are row limits
// fed straight into the useXxxDays(limit) hooks; ALL_DAYS is a sentinel large
// enough to cover any realistic export (Oura shipped in 2015, so ~11 years —
// 10k rows leaves headroom) while keeping the hook signature a plain number.

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
