import { registerSW } from 'virtual:pwa-register'
import i18n from 'i18next'

// ─── Service-worker update prompt ─────────────────────────────────────────────
//
// registerType is 'prompt': a freshly deployed service worker waits until the
// user opts in, instead of auto-reloading mid-session (autoUpdate's behaviour —
// jarring if the user is reading a chart when a deploy lands).
//
// Plain DOM rather than a React component: the toast must exist outside the
// router/Suspense tree and its lifetime is trivial (append once, click,
// reload). Mounting a portal + context for this would be ceremony.
//
// defaultValue fallbacks: the toast can fire before the lazy common namespace
// has loaded; English fallback beats a raw i18n key on screen.

export function setupUpdatePrompt(): void {
  const updateSW = registerSW({
    onNeedRefresh() {
      showToast(() => void updateSW(true))
    },
  })
}

function showToast(onRefresh: () => void): void {
  if (document.getElementById('sw-update-toast')) return

  const toast = document.createElement('div')
  toast.id = 'sw-update-toast'
  toast.setAttribute('role', 'status')
  toast.className =
    'fixed inset-x-4 bottom-24 z-50 mx-auto flex max-w-md items-center justify-between gap-3 ' +
    'rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-lg dark:bg-white dark:text-slate-900'

  const label = document.createElement('span')
  label.textContent = i18n.t('common:update.available', {
    defaultValue: 'A new version is available',
  })

  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = i18n.t('common:update.reload', { defaultValue: 'Refresh' })
  button.className =
    'shrink-0 rounded-lg bg-emerald-500 px-3 py-1.5 font-semibold text-white active:scale-95'
  button.addEventListener('click', onRefresh)

  toast.append(label, button)
  document.body.appendChild(toast)
}
