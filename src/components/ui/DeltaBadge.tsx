import type { ReactElement } from 'react'

// ─── DeltaBadge ───────────────────────────────────────────────────────────────
//
// Period-over-period movement pill, shared by the Dashboard's week tiles and
// the Trends rolling 4-week row. More volume is rendered as positive
// (emerald) — this is a training log, not a golf score. Exact zero is flat:
// with additive totals a 0 delta means genuinely identical periods, so no
// noise threshold is needed (unlike averaged 0–100 scores).
//
// The tooltip text and testid come from the caller: the badge doesn't know
// (or translate) WHICH periods it compares — that context lives at the
// call-site with the numbers themselves.

interface DeltaBadgeProps {
  delta: number
  /** Formats the magnitude — callers pass Math.abs-safe unit formatters. */
  format: (n: number) => string
  /** i18n'd "vs previous …" tooltip. */
  title: string
  testId: string
}

export function DeltaBadge({ delta, format, title, testId }: DeltaBadgeProps): ReactElement {
  const flat = delta === 0
  const cls = flat
    ? 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
    : delta > 0
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
      : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
  const text = flat ? '·' : `${delta > 0 ? '▲' : '▼'} ${format(delta)}`
  return (
    <span
      className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
      title={title}
      data-testid={testId}
    >
      {text}
    </span>
  )
}
