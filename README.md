# Unofficial Strava PWA

**View and analyse your Strava history — private, offline, yours.**

Strava's deeper stats sit behind a subscription, but your data is yours: every account can download its full archive for free. This app turns that export into a training dashboard — weekly volume, trends, personal records — entirely in your browser.

🔗 **Live app:** https://unofficial-strava-pwa.pages.dev

## Privacy — enforced, not promised

- **Your data never leaves your device.** Everything is parsed and stored locally (IndexedDB).
- **No server, no accounts, no analytics, no cookies.** There is nothing to breach.
- Enforced technically: the app ships a [Content-Security-Policy](public/_headers) with `connect-src 'self'` — the *browser itself* blocks any outbound request, including from a compromised dependency.
- One-click **export** (JSON) and **delete** of everything, anytime.

## How to use it

1. On Strava: Settings → My Account → *Download or Delete Your Account* → **Request Your Archive**.
2. Wait for the email (usually within a few hours) and download the ZIP.
3. Open the app and import the ZIP. Done — works offline from then on.

## Features

- **Dashboard** — this week at a glance (distance, time, elevation, activities) with week-over-week deltas, plus recent activities
- **Activities** — full history, filterable by sport, range selector (30d / 90d / 1y / all)
- **Trends** — weekly volume charts per metric and sport, personal records
- **Settings** — km/mi units, dark mode, English + Italiano, re-import, JSON export, clear data
- Pace for runs/walks/hikes, speed for rides — automatically
- Raw GPX/FIT files from your archive are preserved locally for upcoming per-activity detail (routes, HR zones)

## Tech

Vite · React 19 · TypeScript (strict) · Dexie (IndexedDB) · TanStack Router · Tailwind v4 · Web Worker import pipeline (JSZip + Papa Parse + Zod) · hand-rolled SVG charts · Vitest + Playwright · deployed on Cloudflare Pages with a fully gated CI/CD pipeline.

```bash
npm install
npm run dev
npm test           # unit tests
npx playwright test
```

## Legal

This project is **not affiliated with, endorsed by, or connected to Strava, Inc.** in any way. It processes only data that you exported yourself through Strava's official account-archive process. "Strava" is a trademark of Strava, Inc., used here solely to describe compatibility.

[MIT licensed](LICENSE).
