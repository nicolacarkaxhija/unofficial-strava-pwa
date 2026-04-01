// i18n must be imported before RouterProvider so translations are available
// on first render. The import triggers i18next.init() which starts the async
// language-file fetch; react-i18next's Suspense support handles the loading gap.
import './i18n'

import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { ThemeProvider } from './theme/ThemeContext'
import { router } from './router'
import './styles.css'
import { setupUpdatePrompt } from './pwa/updatePrompt'

setupUpdatePrompt()

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('#root element not found')

createRoot(rootElement).render(
  <StrictMode>
    {/* ThemeProvider reads localStorage and applies the `dark` class to <html>
        synchronously on mount, preventing a flash of the wrong theme. */}
    <ThemeProvider>
      {/* Suspense boundary for i18n: shows nothing while locale JSON loads.
          In practice this resolves in < 50ms from the service worker cache. */}
      <Suspense>
        <RouterProvider router={router} />
      </Suspense>
    </ThemeProvider>
  </StrictMode>,
)
