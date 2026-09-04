# Architecture

## Purpose

Record durable module and dependency boundaries.

## Boundaries

- `apps/*` are deployable orchestration surfaces.
- `packages/*` never import from apps.
- `analytics-core` is framework-independent and browser-safe.
- `analytics-next` owns React context and the same-origin route adapter.
- `analytics-server` owns credentials, signing, timeouts, and trusted delivery.
- `db` owns schemas and query functions; app routes do not contain SQL.
- `auth` owns Better Auth configuration and operator session contracts while
  persisting through `db`'s exported Drizzle client/schema.
- The dashboard reads through an API client, never the DB package.
- Organizations group projects for navigation and reporting. They are not yet
  an authorization tenant: the authenticated admin can see every organization,
  while project credentials remain the collector's isolation boundary.
- The public collector and dashboard reads use explicit REST contracts. Midday's
  page composition and state-routing patterns are retained without coupling the
  standalone collector to Midday's private tRPC surface.

## Deep Module Interfaces

- `analytics-core` presents initialization, explicit tracking, opt-in pageviews,
  flushing, reset, and teardown while hiding consent, privacy signals,
  visitor-day state, bounded IndexedDB persistence, cross-tab delivery claims,
  batching, and retry behavior.
- `analytics-next` is the web-framework adapter at the same-origin seam.
- `analytics-server` is the trusted writer and reporting adapter; signing and
  timeouts remain implementation details rather than caller responsibilities.
- Add a new runtime adapter only after a real integration demonstrates behavior
  that cannot be expressed cleanly through an existing adapter.
- Dashboard summary queries and event-list queries are separate interfaces.
  Summary correctness must never depend on event-list pagination limits.
- Dashboard URL state owns the mandatory selected-project workspace, event
  filters, sorting, and detail-sheet identity. TanStack Query owns paged server data; TanStack
  Table and persisted local settings own selection, visibility, sizing, and
  column order. This is the Midday table architecture adapted to Logly's REST
  boundary rather than a new tRPC dependency.
- Dashboard analytics never render an all-project scope. Switching the project
  in the sidebar replaces the workspace context for Overview, Events, Live,
  Insights, and Settings and invalidates project-scoped reads before rendering
  the new data.
- Complete-window event summaries and paginated event rows are separate query
  interfaces. Event detail is fetched by ID and project rather than retained in
  a global all-project row array.

## Privacy Boundary

Browser local IDs are scoped by project storage keys. The collector transforms those IDs with a project-scoped HMAC before persistence. Cross-project joins are forbidden.

Pending browser events use a project-scoped, 24-hour IndexedDB queue capped at
250 events. Local storage holds only the small visitor record; cookies and
React state stores are not analytics persistence boundaries.

## Production Safety Boundary

- Browser ingestion must enforce the stored project origin allowlist.
- Trusted server ingestion must authenticate the scoped key and verify the body
  signature before persistence.
- Persisted dashboard reads require an authenticated operator or a valid
  project-scoped read credential.
- Dashboard pages validate a Better Auth session server-side; proxy cookie
  checks are not authorization.
- Production deployments fail closed when required persistence or credentials
  are absent. Demo data is an explicit non-production mode, never an outage
  fallback.

## Local Infrastructure Boundary

- Product repositories own Docker Compose files, ports, and standard env
  examples; the sibling `local-infra-kit` owns shared mode loading, database
  target safety, Portless startup, and service readiness behavior.
- Logly uses the namespaced `LOGLY_DATABASE_URL` contract locally while retaining
  `DATABASE_URL` compatibility for Vercel production.
- Local Logly and Afterservice run concurrently against separate PostgreSQL
  containers. Product browser events still cross the same-origin proxy boundary
  before reaching Logly.
