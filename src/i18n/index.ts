import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import resourcesToBackend from 'i18next-resources-to-backend'

// ─── i18n Setup ───────────────────────────────────────────────────────────────
//
// Strategy: lazy-load locale JSON files via dynamic import so only the
// active language is bundled into the initial chunk. Adding a new language
// requires only a new file in src/i18n/locales/ — no code changes.
//
// Language detection order: localStorage → navigator.language → fallback to 'en'.
// The user can override in Settings; the choice is persisted to localStorage
// under the key 'i18nextLng'.

void i18n
  .use(LanguageDetector)
  .use(
    resourcesToBackend(
      (language: string, namespace: string) => import(`./locales/${language}/${namespace}.json`),
    ),
  )
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    supportedLngs: ['en', 'it'],
    defaultNS: 'common',
    ns: ['common', 'activities', 'trends', 'settings', 'onboarding'],
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
    interpolation: {
      // React already escapes values — no need for i18next to double-escape
      escapeValue: false,
    },
  })

export default i18n
