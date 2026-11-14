# Vercel Runtime Optimization — 2026-11-14

## Evidence

The [Vercel Optimization Plan](https://chatgpt.com/space/page_0876b65e6cf48191b9269bc50bfc9106)
recorded roughly 22,700 Logly function invocations and 20 minutes of Active CPU
over 30 days, or roughly 53 seconds per 1,000 invocations. That ratio uses
rounded project totals. Read-only Vercel project and deployment requests
returned HTTP 403 with the existing login. Production route and environment
shares, deployed SHA, build settings, and the source of the monthly total
remain unverified.

The dashboard layout already shares a request-scoped overview read with
project selection. Project selection also fetched a scoped overview on four
routes that did not use its aggregates. It now resolves scope and mode from
the shared read, while Overview fetches the scoped aggregates for its range.
An authenticated local collector proxy counted the complete page requests:

| Dashboard page | Before | After | Local p95 before → after |
| --- | ---: | ---: | ---: |
| Live | 3 | 2 | 48.9 → 46.8 ms |
| Events | 5 | 4 | 91.3 → 72.0 ms |
| Insights | 3 | 2 | 85.4 → 70.1 ms |
| Settings | 2 | 1 | 51.1 → 59.8 ms |
| Overview | 2 | 2 | 58.1 → 47.3 ms |

The timing run alternated production-mode Next.js builds against the same
loopback collector and disposable PostgreSQL fixture, with 40 warm samples per
page and build. Settings median fell from 27.8 to 18.3 ms while p95 increased.
Use a protected preview and comparable production windows to judge tail
latency. The call reductions remove one Vercel function invocation per
affected render if the configured collector is itself a Vercel function.

Live already seeded the first page without an immediate browser fetch. A
continuously visible empty stream previously scheduled six requests per
minute before retries. Its 30-second interval schedules two per minute.
An active stream keeps the 10-second interval. A first event after a quiet
period may take up to 30 seconds plus response time to appear, and focus or
reconnect can refresh stale data sooner. Each poll makes one attempt, backs
off to the idle interval after transient failures, and stops after permanent
HTTP failures. The sign-in page validates the cookie server-side so an
expired cookie can reach the sign-in form. No SDK delivery changes were made.

## Build and preview scope

- The root `vercel.json` builds `@logly/dashboard` and emits
  `apps/dashboard/.next`. Turbo's dry run lists the dashboard and the core,
  Next, server, DB, UI, and utility build tasks. Auth and collector are
  source dependencies consumed by Next.js. The standalone `apps/api` and
  native SDK are outside the dashboard build graph.
- Turbo affected-package checks identified the dashboard for a dashboard-only
  commit (`2161615`) and a shared database migration commit (`99eac87`).
  The graph and checks are local evidence. Vercel's skip-unaffected setting
  and which Git branches receive automatic previews still need verification.
- Both Next.js builds report static root and icon routes, dynamic signed
  dashboard pages and route handlers, and a proxy. Local output size is not
  retained Vercel function storage. No skip rule, build command, or
  `.vercelignore` change was needed for this local implementation.
- The configured build runs `deploy:prepare` before Next.js. That command
  applies migrations and conditionally bootstraps the owner using the
  current environment. Before building a preview, confirm it uses a
  separate database and has no production bootstrap credentials.

## Validation and rollout

Dashboard tests, workspace typecheck and tests, production build, and lint
on changed files passed. Workspace lint reports pre-existing formatting in
`packages/utils/src/index.ts`. Desktop and 390px Chrome checks covered seed
data, idle and active poll cadence, a real test event, expired-session
recovery, canonical workspace redirects, and two-project scope. The local
API test used an invalid session cookie and received a 401.

When authorized, verify the deployed SHA, capture 24-hour and seven-day
baselines by normalized route, environment and status, and record a prior
compatible production deployment. In a protected preview, repeat sign-in,
session expiry, project switching, event ingestion and health. Check
affected builds for dashboard, database and standalone-only changes.
Compare invocations, Active CPU per 1,000 requests, p95, and 5xx rates
against equivalent traffic before widening the release. Roll back for a
scope or auth failure or a sustained p95 or error regression. Keep the
collector URL and hosted endpoints in place until the deployment inventory
and callers are verified.
