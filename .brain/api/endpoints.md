# API Endpoints

## Generic analytics context (2026-10-01, local)

- `GET /v1/dashboard/groups`: authenticated, project-required group search,
  max 50 results plus hasMore. Same-origin operator-session proxy:
  `GET /api/dashboard/groups`.
- Existing event-list/summary endpoints accept group type/key, actor and typed
  property equality filters; invalid context filters return 400.
- Existing ingestion accepts optional bounded generic groups. No identity or
  group profile upsert endpoint is introduced.

- `GET /health`: collector health.
- `POST /v1/events`: validated client or server event batch ingestion.
- `GET /v1/dashboard/overview?organization=<slug>&project=<slug>&range=<24h|7d|30d>`:
  organization- and/or project-scoped dashboard summary. Optional range limits
  overview totals, trend, top events, and recent rows to the selected window,
  and adds `trendGranularity`, `previousTrend`, and top-event `previousCount`
  (see `contracts.md`).
- `GET /v1/dashboard/events`: cursor-paged event list with organization/project
  scope, search, event-name/source/date filters, sorting, and a clamped page
  size. The dashboard always supplies a project.
- `GET /v1/dashboard/event-summary?project=<slug>`: complete-window filtered
  total, discovered event-name counts and prior-window momentum, daily trend,
  source mix, top routes, mobile platform/version usage, and geography. A project is required.
- `GET /v1/dashboard/events/:eventId?project=<slug>`: one event detail, returned
  only when the event belongs to the required project.
- `GET /v1/dashboard/event-options`: distinct project, discovered event-name,
  and source values for the selected organization/project scope.
- `GET /v1/dashboard/projects?project=<slug>`: project registry list restricted
  to the authorized project when a project read key is used.
- `GET|POST /api/auth/[...all]`: Better Auth dashboard session endpoints.
- `POST /api/projects`: same-origin, authenticated operator endpoint that
  creates a project inside an organization from a normalized 1–10-origin
  allowlist and returns four scoped plaintext credentials exactly once.
- `POST /api/organizations`: same-origin, authenticated admin endpoint that
  creates an automatically slugged organization.
- `GET /sign-in`: public operator sign-in page; there is no public sign-up page.
- `GET /api/dashboard/events`: Better Auth-protected same-origin proxy used by
  the Events table for incremental reads without exposing the server read key.
- `GET /api/dashboard/event-summary`: Better Auth-protected same-origin proxy
  for filter-aware, complete-window event analytics.
- `GET /api/dashboard/events/:eventId?project=<slug>`: Better Auth-protected,
  project-scoped event-detail proxy used by the global detail sheet.
- `GET /v1/dashboard/funnel?project=<slug>&steps=<event,event>`: authenticated,
  complete-window ordered visitor-day funnel; optional organization/start/end,
  two to five steps, maximum 90-day range. See contracts for counting rules.

- Event list, options and summary reads accept `platforms`. Event-summary endpoints include the additive `mobile` platform/version aggregate and `geography` country-visit aggregate. `POST /v1/events` accepts mobile platform/app release metadata and country only through authenticated proxy request metadata; see the contracts.

## Project key reissue — 7 October 2026

- `POST /api/project-keys`: same-origin admin-session mutation accepting organization/project slugs and one of the four existing scopes. Returns one new plaintext key once, with `Cache-Control: no-store`; unavailable, mismatched or disabled projects return 404.

## Breakdown — 2026-11-12 (local)

- `GET /v1/dashboard/breakdown?project=<slug>&start=<iso>&end=<iso>&by=<dims>`:
  read-key authenticated complete-window breakdown by 1–2 dimensions with
  event/distinct-actor/distinct-group metrics, optional UTC daily series,
  top-N plus `(other)`/`(none)` buckets, and optional p50/p95 of a numeric
  property. Invalid input returns 400. See the contracts.

## Pages report and tracking alerts — 2026-11-24 (local, unreleased)

- `GET /v1/dashboard/pages?project=<slug>&range=<24h|7d|30d>&view=<page_view|screen_view>`:
  read-key or operator authenticated, project required. `range` defaults to
  `7d`; `view` is optional (auto-selected). Invalid range/view returns 400.
  Without a database it returns the demo summary. Dashboard page: `/pages`.
- `GET /v1/dashboard/tracking-alerts?project=<slug>`: current tracking-quiet
  state plus the 20 most recent alerts; 400 without a project, 404 for an
  unknown project. Runs the throttled alert evaluation first.
- `GET /v1/dashboard/overview` now also runs the throttled alert evaluation
  (at most once per project per 5 minutes, bounded to 1.5s) and adds optional
  `projects[].trackingAlert`.
