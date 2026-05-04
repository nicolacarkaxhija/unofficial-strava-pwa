// ─── NoDataState ──────────────────────────────────────────────────────────────
//
// Resolved "nothing found" state for detail pages. A resolved not-found (hook
// returned null) must look different from loading: an endless skeleton reads
// as a hang, while this tells the user the id simply isn't in their export and
// offers a way back to the list.

import { useTranslation } from 'react-i18next'
import { Link } from '@tanstack/react-router'
import type { ReactElement } from 'react'

export function NoDataState(): ReactElement {
  const { t } = useTranslation('common')
  return (
    <div
      className="flex flex-col items-center gap-4 px-4 pt-16 pb-6 text-center"
      data-testid="no-data-state"
    >
      <p className="text-sm text-slate-500 dark:text-slate-400">{t('notFound')}</p>
      <Link
        to="/activities"
        className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200"
      >
        {t('back')}
      </Link>
    </div>
  )
}
