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
- `GET|POST /api/auth/[...all]`: Better Auth dashboard session endpoints,
  including the passkey plugin's `/passkey/*` routes (registration options and
  verification, authentication options and verification, list, update and
  delete). Registration, list, update and delete require a session.
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
- `GET /v1/dashboard/funnel?project=<slug>&steps=<json|event,event>`:
  authenticated ordered per-visitor funnel; optional organization, start/end
  (90 days max), `window` and `breakdown`; 2–8 steps. Superseded the
  visitor-day version on 2026-11-24 (see "Funnels" below and the contracts).

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

## Deploy markers — 2026-11-24 (local, unreleased)

- `POST /v1/releases`: trusted-writer release ingest. Bearer `server-write`
  project key (or `LOGLY_SERVER_KEY`) plus `x-logly-signature` (hex HMAC-SHA256
  of the raw body). 201 created, 200 already recorded, 400 invalid, 401
  unauthenticated/bad signature, 404 unknown or disabled project, 413 body over
  4 KiB, 429 over 30/min per client, 503 database unavailable. Not behind the
  dashboard proxy (`/v1/` is excluded from the session matcher).
- `GET /v1/dashboard/releases?project=<slug>[&start=<iso>&end=<iso>&environment=<production|preview>&limit=<1-200>]`:
  read-key or operator authenticated; newest first, at most 200; 400 without a
  project or with an invalid time/environment.
- `GET /api/releases?project=<slug>&start&end&environment`: Better Auth
  session proxy of the read above, used by the client-rendered Events chart.
- `POST /api/releases`: same-origin admin-session manual marker (same body and
  validation as `/v1/releases`, stored with `source = 'dashboard'`).
- `DELETE /api/releases?project=<slug>&id=<uuid>`: same-origin admin-session
  delete scoped to the project; 404 when no row matched.

## App-version adoption — 2026-11-24 (local, unreleased)

- `GET /v1/dashboard/app-versions?project=<slug>&range=<24h|7d|30d>&organization=<slug>`:
  read-key or operator authenticated, project required, `range` defaults to
  `7d`, invalid range returns 400. Without a database it returns the demo
  summary. Read-only; no new write path, env var, cron or Vercel config.
  Dashboard page: `/versions` (request-rendered, `ƒ` in the build output).

## Retention — 2026-11-24 (local, unreleased)

- `GET /v1/dashboard/retention?project=<slug>&range=<7d|30d|12w>&surface=<all|web|mobile>&event=<name>&organization=<slug>`:
  read-key or operator authenticated, project required. `range` defaults to
  `30d`, `surface` to `all`; an invalid range or surface returns 400. `event`
  is optional (blank or over 120 characters means any event). Without a
  database it returns the demo summary. Read-only; no new write path, env var,
  cron or Vercel config. Dashboard page: `/retention` (request-rendered, `ƒ`
  in the build output).

## Funnels — 2026-11-24 (local, unreleased)

- `GET /v1/dashboard/funnel`: extended with JSON `steps` (route and property
  filters), `window` (`1h`/`1d`/`7d`/`30d`), `breakdown`
  (`platform`/`country`/`app_version`/`source`); response adds
  `stepConversion`, `medianSeconds`, `route`, `property`, `segments`,
  `capped`, `visitorCap`, `window`, `breakdown`. 503 on statement timeout.
- `GET /v1/dashboard/funnels?project=<slug>`: read credential; saved funnels,
  known events with stored property keys, and top routes for the builder.
- `POST /api/funnels`, `PATCH /api/funnels`, `DELETE /api/funnels?project=&id=`:
  dashboard route handlers, admin session + trusted same origin, writing
  `analytics_funnels` in-process through `@logly/db/queries` (like
  `/api/releases`).
- Page `/funnels`: request-time render; one options read and at most one
  funnel read per view, no polling.

## Event catalog — 2026-11-24 (local, unreleased)

- `GET /v1/dashboard/event-catalog?project=<slug>&range=<24h|7d|30d>&stale=<7|14|30|90>&organization=<slug>`:
  read credential; `range` defaults to `7d`, `stale` to `14`; invalid values
  return 400, a statement timeout 503. Demo summary without a database.
- `GET /v1/dashboard/event-options`: with `project`, leaves out names hidden
  in the catalog and adds `deprecated: string[]` when any.
- `GET /v1/dashboard/funnels`: `events[]` leaves out hidden names and marks
  `deprecated: true`; adds `hidden: string[]` when any.
- `PUT /api/event-catalog`: dashboard route handler, admin session + trusted
  same origin, upserting `analytics_event_catalog` in-process through
  `@logly/db/queries` (like `/api/releases` and `/api/funnels`).
- Page `/catalog`: request-time render, one catalog read per view, no
  polling. No env vars, cron or Vercel config changes.

## Email channel — 2026-11-24 (local, unreleased)

Dashboard route handlers (feature 8, [ADR 0020](../decisions/0020-email-channel-weekly-digest.md)):

- `GET /api/cron/email`: Vercel cron, daily `0 7 * * *` UTC. Bearer
  `CRON_SECRET` (503 when unset, 401 on mismatch). Evaluates tracking alerts,
  emails alert transitions, sends last week's digests; returns
  `{ status: "ok"|"disabled", reason?, alerts: { sent, failed },
  digests: { sent, failed, projects }, truncated }`. `maxDuration` 60 s.
- `PUT /api/email/subscriptions`: admin session + trusted same origin. Body
  `{ project, userId, scope: "project"|"organization", weeklyDigest,
  trackingAlerts }` (≤ 2 KB); both false deletes the row. 404 for an unknown
  project or operator.
- `POST /api/email/test`: admin session + same origin, `{ project }`. Sends
  last week's digest to the signed-in admin only; 409 when sending is disabled
  (local/preview/missing keys), 502 when the provider rejects it.
- `GET /api/email/preview?project=<slug>&format=text`: admin session. Rendered
  HTML (restrictive CSP) or the text fallback of last week's digest.
- `GET|POST /api/email/unsubscribe?token=<signed>`: public (proxy-exempt).
  GET renders a confirmation form and changes nothing; POST (form or RFC 8058
  one-click) unsubscribes. 400 page for an invalid token.

All are request-rendered (`ƒ`). No collector (`/v1`) contract changes.
