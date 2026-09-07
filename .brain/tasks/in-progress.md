# In Progress

## Production Trustworthiness And Afterservice Pilot

- Status: in progress.
- Production Postgres is configured and all three reviewed migrations are applied;
  verify a restorable backup.
- Complete-window SQL aggregates are implemented independently from the bounded
  200-row event-detail list.
- Better Auth email/password sessions, disabled public sign-up, protected
  dashboard routes, and guarded owner bootstrap are implemented and locally
  QA-verified. Production Neon, auth runtime configuration, migrations, and the
  guarded owner bootstrap are complete. Authenticated production Chrome QA
  confirms the bootstrapped Ishaq Yusuf operator, protected event dashboard,
  and Personal / Afterservice navigation. A fresh production credential cycle
  verified the requested owner email/password sign-in and authenticated
  sign-out endpoints with HTTP 200 responses without retaining credentials.
- Project-origin enforcement, trusted server signature verification, and
  fail-closed production configuration are implemented and deployed. Project
  creation accepts 1–10 normalized production origins for multi-surface apps.
- Implement idempotent daily rollups, retention cleanup, and real collection
  health measurements.
- The three SDK packages are registry-published and their clean packed artifacts
  and npm-backed Afterservice resolutions are verified.
- Project-scoped API-key verification is complete for client ingest,
  server-write, and dashboard reads.
- Core `0.1.0` was the initial release under the approved `@ishaqyusuf` scope.
  Core, Next.js, and server packages are now published together as `0.2.0` with registry-safe `^0.2.0`
  internal dependencies. The public package test scripts now propagate
  failures, the batch contract uses the published core-package identity, and
  clean final tarballs contain only package metadata, README, and built runtime
  and declaration files. The current Logly typecheck and 36-test suite pass,
  alongside the earlier full build and lint. npm password
  verification succeeded as a fallback to the failing cross-device passkey. A
  seven-day read/write token limited to the `@ishaqyusuf` scope was created and
  used for the coordinated release.
- Keep the pilot limited to visitor-day tracking, explicit automatically
  discovered events, and basic reporting.
- Do not add new analytics breadth until Afterservice and a second product prove
  a repeated decision need.
- Local-first testing is implemented: Logly and Afterservice run concurrently
  through shared local-infra profiles, Logly uses Docker PostgreSQL, and a new
  uncatalogued Afterservice event was accepted and displayed locally. The
  repeatable Afterservice `bun run smoke:logly:local` command now sends a unique
  event and verifies it through Logly's scoped read endpoint. Afterservice's
  full local MVP smoke also passes with its real queued notification worker.
  Afterservice now resolves all three SDKs from npm, its dashboard and marketing
  surfaces are deployed, and Chrome production QA shows real browser and
  uncatalogued smoke events in the selected Afterservice project. The first
  pilot cutover is complete; the next product is the remaining boundary test.
- Organization/project grouping and the GND-style hover-expanding sidebar are
  implemented, locally QA-verified, migrated, and deployed to production in
  Vercel deployment `dpl_CegLVNHvK3nF2hpHaXNdPd46KShA`. Production browser QA
  confirmed the existing Afterservice project under the backfilled `Personal`
  organization. Organizations are navigation/reporting groups in this
  single-operator phase; memberships and invitations are not implied.

## Durable Browser Delivery

- Status: implemented and validated locally.
- Browser events persist in a bounded IndexedDB queue with memory fallback,
  cross-tab claims, stable retry IDs, 60-second/25-event/48-KiB batching, and
  lifecycle/reconnect flush triggers.
- The first-ever `site_visit` sends immediately; later visitor-days are batched.
- Pathname-only pageviews and safe `data-logly-event` clicks are opt-in and are
  enabled in the Logly dashboard proving integration.
- Collector and database contracts recognize `site_visit` and `page_view` as
  reserved system events; no database migration is required.
- Coordinated `0.2.0` artifacts are published as
  `@ishaqyusuf/logly-core`, `@ishaqyusuf/logly-next`, and
  `@ishaqyusuf/logly-server` and are installed from npm by the first pilot.

## Dashboard Redesign Exploration

- Status: Signal Desk approved, implemented, and locally validated.
- The current local dashboard, authenticated OpenPanel project navigation, and
  reusable analytics dashboard references were reviewed in Chrome.
- Three clean-room concepts and their design reviews live in `.design/`.
  **Signal Desk** is the recommended direction because it balances trend
  visibility, event investigation, project context, and collection trust while
  preserving Logly's thin-product boundary.
- The recommended clickable suite covers Overview, Events, Projects, Settings,
  event detail, loading, empty, error, and mobile states. It uses standard
  shadcn-style composition and maps charts and tables to Recharts and TanStack
  Table for a future implementation.
- Desktop, tablet, and 390-pixel mobile layouts were browser-checked with no
  horizontal page overflow or console errors. Search and event-detail
  interactions were smoke-tested.
- Concept A and the Overview calls to action now link directly to the dedicated
  Events explorer instead of scrolling to the Overview page's recent-events
  summary. The review index labels the three variants as overview concepts and
  exposes Overview and Events as separate top-level previews.
- The real dashboard now has separate Overview and Events routes. Overview
  includes full-window KPI cards, a 14-day event chart, top/recent events, and
  collector health. Events ports the applicable Midday invoice table core and
  filter interaction architecture onto Logly's REST boundary: server-side
  filters/sort, cursor paging, TanStack Query caching, virtualization, infinite
  loading, sticky/resizable/reorderable columns, persisted visibility/settings,
  row selection, JSON actions, and URL-owned detail sheets.
- Authenticated Chrome QA passed at desktop and 390-pixel mobile widths for
  navigation, source filtering, sorting, event detail, and selection actions
  without console errors. Repository typecheck, lint, tests, and the production
  dashboard build pass. No database migration was required.
- Signal Desk is deployed to the canonical production alias in Vercel
  deployment `dpl_DfoLrrGviexgUp88ETcThV5WFNYN`. The production migration step
  completed idempotently, `/health` returned the collector payload with HTTP
  200, unauthenticated dashboard/API reads redirected to sign-in, and
  authenticated Chrome QA verified real Neon-backed Overview metrics, event
  rows, source filtering, sorting, and the event-detail sheet with no console
  errors.

## Project Workspace Design Exploration

- Status: Signal Studio selected, implemented, and locally browser-validated.
- The product model now treats one selected project as the mandatory workspace
  for Overview, Events, Live, Insights, and Settings. Projects is removed from
  navigation; switching and creation remain inside the sidebar selector.
- New prototypes live in `.design/project-workspaces/`: Signal Studio, Event
  Atlas, Dark Operations, Editorial Ledger, Compact Grid, and Calm Monitor.
- Every Events direction includes complete filtered event count, count by event
  name, trend, momentum, source/search filters, the Midday-style row table, and
  event detail. Summary values are explicitly separate from pagination.
- Project switching, URL persistence, event filtering, detail opening, all six
  desktop layouts, all six 390-pixel mobile layouts, console errors, and
  horizontal page overflow were browser-checked. Signal Studio is the current
  implementation direction, with Event Atlas retained as an alternative design.
- The production dashboard code now treats the selected project as mandatory
  across Overview, Events, Live, Insights, and Settings. Projects is removed
  from navigation and its legacy route redirects to Settings.
- Events now combines complete-window filtered total, daily trend, prior-window
  momentum, and every discovered event-name count with the existing Midday
  table core. Event detail is loaded by ID through a project-scoped route.
- Local Chrome QA confirmed all five connected pages, URL-preserved project
  scope, the event detail sheet, empty Live state, and no console errors.
  Typecheck, the full test suite, lint, and the production dashboard build pass.
  No database migration was required.
- Vercel Git integration is connected to `ishaqyusuf/logly`; `main` is the
  production branch and automatic Git deployments are enabled. The Vercel
  project build command now runs `deploy:prepare` before `build:dashboard`.
  The first Git-triggered production deployment completed as
  `dpl_GeFSJRRcQcv7qsZJns3qGrUpwa4j` and was promoted to the canonical alias.
  Health and unauthenticated route-protection canaries pass, so the Signal
  Studio production release is complete.

## Portfolio Analytics Expansion

- Status: in progress, authorized 2026-09-07.
- Tickets LGL-101–108 and acceptance evidence are tracked in `analytics-expansion/plan.md`.
- Feature selection: acquisition reports, same-day ordered funnels, observed collection health.
- Integrations: Halaalvest web/mobile, Ewatrade web/mobile, School Clerk web.
- ADR 0006 records the updated scope and preserves privacy boundaries.
- Acquisition and observed collection-health UI are now implemented locally with real SQL acceptance checks and desktop/mobile screenshots. Combined validation/release and funnels remain pending before consumer cutovers.
- Same-day funnel reporting now implemented locally with 251 → 200 → 100 SQL fixture and responsive screenshot evidence. All three selected features pass the combined 49-test suite, typecheck, lint and production build; deployment pending.
- Reporting release `4f8cea9` deployed successfully to the canonical Logly alias; production acquisition/funnel/health checks pass. Consumer integrations remain active.

## Portfolio integration source checkpoint — 2026-09-07

All five production projects provisioned. Halaalvest, Ewatrade and SchoolClerk shared analytics packages, layouts/proxies, native runtimes where requested, local production credentials and Turbo declarations are implemented. 21 consumer tests pass. See [screenshot and validation report](analytics-expansion/report.md) for broader-check limitations and outstanding consumer rollout/acceptance. Logly itself is deployed and verified.

## Country heat map — 2026-09-07

User-authorized world map implemented with country rankings, percentage readout, unknown locations and responsive layouts. Country ingestion/aggregation and additive migration pass local SQL retry/scope checks. Tests, lint, typecheck and dashboard build pass; see `country-map/report.md` for deployment and screenshots. SDK 0.2.1 publication was explicitly approved and accepted by npm; registry metadata and downloaded artifact are verified; consumer live testing remains deferred.
