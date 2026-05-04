import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/router-devtools'
import { lazy, Suspense } from 'react'
import App from './App'

// ─── Route tree ───────────────────────────────────────────────────────────────
//
// Four flat tabs plus /activities/$id. The detail route is a ROOT-level
// SIBLING of /activities, not its child: ActivityList renders no <Outlet/>,
// so a child route would silently render nothing — exactly the trap that
// shipped as a bug in the sibling template. Flat siblings keep every page
// responsible only for itself.

// ─── Page components (lazy-loaded for code splitting) ─────────────────────────
const Dashboard = lazy(() => import('./pages/Dashboard'))
const ActivityList = lazy(() => import('./pages/activities/ActivityList'))
const ActivityDetail = lazy(() => import('./pages/activities/ActivityDetail'))
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

const activityDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/activities/$id',
  // Param validation only asserts "id is a non-empty string" — whether it
  // exists in the DB is the page's concern (useActivity resolves null and the
  // page renders the NoDataState, per the null-vs-undefined hook contract).
  params: {
    parse: (params) => {
      if (!params.id) throw new Error('Activity id must be a non-empty string')
      return { id: params.id }
    },
    stringify: (params) => ({ id: params.id }),
  },
  component: ActivityDetail,
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
  activityDetailRoute,
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
