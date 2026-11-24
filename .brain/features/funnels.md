# Funnel builder

Status: built locally on `main` (feature 6 of the coordinated 8-feature
release, 2026-11-24); unreleased. [ADR 0018](../decisions/0018-funnels-ordered-per-visitor-window.md).

## Purpose

Show how many visitors complete an ordered list of steps, where they drop off
and how long each step takes, and keep useful funnels per project so they can
be revisited. Replaces the same-day funnel card that used to sit on Insights.

## Behavior

- Page `/funnels` (sidebar "Funnels"), project-scoped like every workspace page.
- Builder: 2–8 steps. Each step is an event name typed into a search field
  backed by the project's known events (names seen in the last 30 days, top
  200, via a browser datalist). An unknown name is allowed but flagged "Not
  seen in the last 30 days" so a saved funnel survives quiet periods.
- Optional per step:
  - Route: an exact recorded route template (`/orders/:id`), suggested from
    the project's top 100 routes.
  - One property equals-filter. Keys are limited to property keys Logly has
    stored for that event (sampled from the latest 5,000 events in 30 days);
    the value is compared as text (`properties ->> key = value`).
- Conversion window: 1 hour, 1 day, 7 days or 30 days. Date range: last 7, 30
  or 90 days. Optional breakdown: platform, country, app version or source.
- Results: a bar per step with visitors, % of step 1 and % of the previous
  step; between steps the drop-off (count and %) and the median time from the
  previous step. With a breakdown, a table of per-step counts for the top 5
  values plus `(other)`, and each value's overall conversion.
- URL state: `funnel` (saved id), `steps` (JSON), `window`, `range`,
  `breakdown`. Explicit params override a saved funnel's definition, so an
  edited, unsaved funnel is shareable by URL.
- Saved funnels: name, steps and window per project (the date range and
  breakdown are chosen when viewing). Listed beside the builder for everyone
  signed in. Saving, updating ("Update" / "Save as new") and deleting need an
  admin session and the database mode; non-admins see a note instead.

## Counting rules

- A visitor is the project-scoped `visitor_key`. Browser IDs persist in local
  storage across days; mobile IDs persist per install. Events without a key
  are excluded. Every source counts when it carries a key, so a trusted server
  event joins only if the product forwards the browser's `visitorId`.
- Entry: a visitor's earliest step-1 event in the range. Later step-1 events
  do not re-enter them; one attempt per visitor per range. A visitor whose
  first attempt failed but a later one succeeded counts as not converted.
- Step N: the earliest matching event strictly after the time step N-1 was
  reached and no later than entry + window, inside the range.
- Repeats: each visitor counts at most once per step. One event never
  satisfies two steps, so `a → a` needs two separate `a` events; equal
  timestamps do not count as "after".
- Median time: per step, the median seconds from the previous step among
  visitors who reached it (`percentile_cont(0.5)`); not shown for step 1.
- Breakdown: the value on the visitor's step-1 event (null or blank values are
  `(none)`); the top 5 by entrants are kept and the rest folded into `(other)`.
- Cost bounds: 2–8 steps, a 90-day range, the earliest 50,000 entrants (the
  result sets `capped` and the page says so), a 15-second statement timeout
  (503 "Narrow the date range"), and only the steps' event names are scanned
  through `(project_id, name, occurred_at)`. Saved funnels are capped at 50 per
  project. Page reads are request-time (`force-dynamic`), one funnel query and
  one options read per view; no polling, cron or cache.

## Data And API

- Table `analytics_funnels` (migration `0011_saved_funnels`). See the
  [schema](../database/schema.md) and [migrations](../database/migrations.md).
- `GET /v1/dashboard/funnel` (extended) and `GET /v1/dashboard/funnels`
  (new), plus the dashboard's admin-only `POST/PATCH/DELETE /api/funnels`.
  See [endpoints](../api/endpoints.md) and [contracts](../api/contracts.md).
- Shared contract and in-memory spec: `packages/utils/src/funnel.ts`. SQL and
  saved-funnel queries: `packages/db/src/queries/funnel.ts`. UI:
  `apps/dashboard/src/components/funnels/*`, `app/(sidebar)/funnels/page.tsx`.

## Example: gnd quote funnel

Logly has no gnd quote events: gnd's web policy only allows `site_visit`,
`page_view` and `dealer_program_progress_viewed`, and the mobile app sends
`app_session`, `screen_view`, `job_opened`, `sales_order_opened`,
`document_viewed` and `notification_opened`. To measure quote opened → edited →
accepted, gnd must add `quote_opened`, `quote_edited` and `quote_accepted` to
its policy allowlist and track them (see the consumer upgrade guide, row 6).
Until then the closest web proxy is `page_view` on
`/sales-book/edit-quote/:id`.

Customer acceptance happens on `/sales/accept-quote` by the customer, not by
the staff member who opened and edited the quote, so a single-visitor funnel
fits staff steps (opened → edited → sent) and customer steps (accept page
viewed → accepted) separately, not the whole handoff.

`packages/db/scripts/seed-funnel-qa.ts` seeds that gnd-shaped funnel into the
local database (`funnel-qa-gnd-*`, 4 iOS + 6 web staff) with a saved funnel
"Quote opened → edited → accepted" (window 1 day) and asserts the answers.

## Acceptance Checks

- Unit tests (`apps/dashboard/src/lib/funnel.test.ts`): ordering, cross-day
  windows, first-entry rule, sources and project isolation, repeats, route
  and property filters, breakdown folding, the visitor cap and parsing.
- Route tests (`funnel-route.test.ts`): admin + same-origin for create,
  update and delete; 401/403/400/409.
- SQL fixture (`packages/db/src/queries/funnel.sql.test.ts`, `logly_test`):
  the query equals the in-memory spec on 400 generated visitors across seven
  cases (windows, repeated and filtered steps, three breakdowns, the cap);
  wrong organization; saved-funnel CRUD, duplicates, cross-project isolation
  and the 50 limit; builder options.
- Local seed (`seed-funnel-qa.ts`): 10 → 6 → 3 in 1 day, 10 → 6 → 4 in 7 days,
  medians 35 and 160 minutes, `channel = email` 10 → 6 → 2, platform
  breakdown web 6/2/0 and iOS 4/4/3. The same numbers were read over HTTP
  from the local collector.
- Visual QA at desktop and 375px of the real builder and results through a
  temporary unauthenticated local route (deleted, never committed): no
  horizontal overflow, the edited funnel (7 days, `channel = email`) reads
  10 → 6 → 3, Run builds the expected URL, and `/funnels` redirects to
  sign-in without a session. The authenticated page needs an operator sign-in
  to view.
