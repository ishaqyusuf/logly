# Pages report

Implemented locally 2026-11-24 (unreleased; ships with the 8-feature release).

`/pages` is a selected-project workspace page beside Overview, Events, Live,
Insights and Settings. It reads `GET /v1/dashboard/pages` (see
`../api/contracts.md`).

- Web projects report `page_view`; mobile projects report `screen_view`. The
  view is chosen automatically (page views, else screen views when a project
  has only those) and can be forced with `?view=`. A toggle appears when a
  project has both.
- Range: URL-backed `24h`, `7d` (default) and `30d`, rolling to now, like
  Pulse. Change compares with the immediately preceding equal window using
  Pulse's `percentChange` rule; a route with no prior views shows "New".
- KPIs: views, unique visitors (distinct project-scoped visitor keys), views
  per visitor. Top 25 routes with views, visitors and both changes.
- Entry and exit pages: the first and last view per visitor per UTC day
  (visitor-day, the same unit as funnels), top 10 each with their share of
  visitor-days. Derived from existing rows with window functions; no session
  model, table or rollup was added.
- Routes appear exactly as recorded. Events from before route templates
  (ADR 0012, SDK 0.3.0) may be raw paths such as `/orders/4812` or GND's
  `/other`; null routes show as "(no route)". No backfill.

Cost: three bounded SQL reads per view, each limited to one project, one event
name and the current plus previous window, served by the existing
`(project_id, name, occurred_at)` index. No caching; the page is
request-rendered like Overview.

Product projects benefit fully only after upgrading to
`@ishaqyusuf/logly-core`/`-next` 0.3.0 (web) or `@ishaqyusuf/logly-native`
0.1.0 (mobile, `trackScreenView`), which record templated routes.

Follow-ups: per-route drill-down into Events, bounce rate, and real session
boundaries (inactivity timeout) if visitor-day proves too coarse.
