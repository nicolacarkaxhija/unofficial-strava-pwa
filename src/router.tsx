import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/router-devtools'
import { lazy, Suspense } from 'react'
import App from './App'

// ─── Route tree ───────────────────────────────────────────────────────────────
//
// Four flat tabs, no params: v1 has no detail routes (a detail page earns its
// place in phase 2 when parsed GPX tracks give it a map to render). TanStack
// Router is kept over a hand-rolled switch for typed Links and because phase 2
// WILL add /activities/$id — swapping routers later would touch every page.

// ─── Page components (lazy-loaded for code splitting) ─────────────────────────
const Dashboard = lazy(() => import('./pages/Dashboard'))
const ActivityList = lazy(() => import('./pages/activities/ActivityList'))
const Trends = lazy(() => import('./pages/trends/Trends'))
const Settings = lazy(() => import('./pages/Settings'))

const rootRoute = createRootRoute({
  // The root renders App which handles the onboarding gate, app shell, and
  // BottomNav. <Outlet /> inside App receives the matched child route page.
  // TanStackRouterDevtools renders only in development (tree-shakes in prod).
  component: () => (
    <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading…</div>}>
      <App />
      {import.meta.env.DEV && <TanStackRouterDevtools />}
    </Suspense>
  ),
})

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Dashboard,
})

const activitiesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/activities',
  component: ActivityList,
})

const trendsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/trends',
  component: Trends,
})

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: Settings,
})

// ─── Router instance ──────────────────────────────────────────────────────────

const routeTree = rootRoute.addChildren([
  dashboardRoute,
  activitiesRoute,
  trendsRoute,
  settingsRoute,
])

export const router = createRouter({ routeTree })

// Registers the router type globally so `useParams`, `Link`, and `navigate`
// are fully typed throughout the app without prop drilling.
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
