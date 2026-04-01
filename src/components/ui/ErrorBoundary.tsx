// ─── ErrorBoundary ────────────────────────────────────────────────────────────
//
// React class component — class components are still the ONLY way to implement
// an error boundary in React. Functional components cannot use componentDidCatch
// or getDerivedStateFromError because there is no functional equivalent in React's
// public API (as of React 19). This is not legacy code; it is the prescribed pattern.
//
// Route-reset strategy:
//   We accept an optional `routeKey` prop that callers can derive from the current
//   pathname (e.g. via useRouterState). When `routeKey` changes, getDerivedStateFromProps
//   clears `hasError`, effectively resetting the boundary. This mirrors the pattern
//   recommended in the React docs: change a `key` on the boundary to reset it.
//   We implement it explicitly here so page transitions don't leave users stuck
//   on an error screen after navigating away and back.

import { Component, type ReactNode, type ErrorInfo } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  // Tie to current route path so the boundary resets on navigation
  routeKey?: string
}

interface ErrorBoundaryState {
  hasError: boolean
  routeKey?: string
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    // exactOptionalPropertyTypes: don't explicitly set routeKey to undefined;
    // omit the key when props.routeKey is absent.
    this.state =
      props.routeKey !== undefined
        ? { hasError: false, routeKey: props.routeKey }
        : { hasError: false }
  }

  static getDerivedStateFromProps(
    props: ErrorBoundaryProps,
    state: ErrorBoundaryState,
  ): Partial<ErrorBoundaryState> | null {
    // If the route changed, clear the error so the new route can render cleanly
    if (props.routeKey !== state.routeKey) {
      // exactOptionalPropertyTypes: omit routeKey key when undefined
      return props.routeKey !== undefined
        ? { hasError: false, routeKey: props.routeKey }
        : { hasError: false }
    }
    return null
  }

  static getDerivedStateFromError(_err: Error): Partial<ErrorBoundaryState> {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface to console in dev; production apps would send to an error tracker
    // (Sentry, Datadog, etc.) — wired up in Wave 2 observability work.
    console.error('[ErrorBoundary] Uncaught render error:', error, info.componentStack)
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
            <p className="text-lg font-semibold text-gray-800 dark:text-gray-100">
              Something went wrong
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Try navigating away and back, or reload the page.
            </p>
          </div>
        )
      )
    }

    return this.props.children
  }
}
