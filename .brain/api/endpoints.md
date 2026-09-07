# API Endpoints

- `GET /health`: collector health.
- `POST /v1/events`: validated client or server event batch ingestion.
- `GET /v1/dashboard/overview?organization=<slug>&project=<slug>`:
  organization- and/or project-scoped dashboard summary.
- `GET /v1/dashboard/events`: cursor-paged event list with organization/project
  scope, search, event-name/source/date filters, sorting, and a clamped page
  size. The dashboard always supplies a project.
- `GET /v1/dashboard/event-summary?project=<slug>`: complete-window filtered
  total, discovered event-name counts and prior-window momentum, daily trend,
  source mix, and top routes. A project is required.
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

- Event-summary endpoints now include the additive `geography` country-visit aggregate. `POST /v1/events` accepts country only through authenticated proxy request metadata; see country contract.
