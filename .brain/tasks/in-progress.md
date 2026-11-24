# In Progress

## Weekly email digest — 2026-11-24

- Status: committed locally on `main` (`e9fa14a`), unreleased (feature 8 of
  the 8; held for the coordinated release; nothing pushed, deployed, migrated
  in production or published, and no real email sent).
- [Email digest](../features/email-digest.md),
  [ADR 0020](../decisions/0020-email-channel-weekly-digest.md) (adds email to
  [tracking alerts](../features/tracking-alerts.md); the cron now also
  evaluates them).
- Migration `0013_email_digest` (`analytics_email_subscriptions`,
  `analytics_email_sends`). Not applied to the shared local database, so
  `0012` (feature 7) and `0013` apply in order there. Next free: `0014`.
- New package `@logly/email`; routes `GET /api/cron/email` (daily cron),
  `PUT /api/email/subscriptions`, `POST /api/email/test`,
  `GET /api/email/preview`, `GET|POST /api/email/unsubscribe`; Settings →
  Email (admin).
- Before release the user must: create a Resend account, verify a sending
  domain (DNS), create an API key; add Vercel Production env vars
  `RESEND_API_KEY`, `EMAIL_FROM` (e.g. `Logly <digest@your-domain>`),
  `CRON_SECRET` (random, 16+ chars), optional `EMAIL_REPLY_TO`; confirm
  `NEXT_PUBLIC_DASHBOARD_URL` or `BETTER_AUTH_URL` is the public dashboard
  URL. `vercel.json` already declares the cron (daily, valid on Hobby).
  After deploy: opt operators in under Settings → Email and use "Send test
  digest to me".
- Checks: email package (25 tests, fake transport and fake store: idempotent
  re-runs, concurrent runs, retry/reject, disabled transport, send cap),
  dashboard route tests (cron auth fails closed, admin/same-origin, test
  send, unsubscribe GET is inert and POST works, forged token), and the
  `logly_test` SQL fixture (exclusive claims under concurrency, attempt cap,
  stale-claim recovery, recipient dedupe, unsubscribe scope, digest
  metrics). Lint, tests and `bun run build:dashboard` pass; typecheck passes
  except feature 7's in-progress `event-catalog.sql.test.ts`.
- The digest and alert emails were rendered from seeded data (a gnd-shaped
  project in Africa/Lagos, two weeks of events, releases and an alert, in a
  throwaway `logly_test` schema) and browser-checked at desktop and 375px. The
  Settings → Email section was not browser-checked: it needs an operator
  sign-in, migration `0013` applied locally, and a dev server (starting
  `logly-dev` would restart the event-catalog session's servers).
- Follow-ups: hourly cron on a Pro plan for faster alert emails; Resend
  bounce webhooks; a retention job for `analytics_email_sends`.

## Funnel builder — 2026-11-24

- Status: committed locally on `main` (`39993f7`), unreleased (feature 6 of
  the 8; held for the coordinated release; nothing pushed, deployed, migrated
  in production or published).
- [Funnel builder](../features/funnels.md),
  [ADR 0018](../decisions/0018-funnels-ordered-per-visitor-window.md)
  (supersedes ADR 0006's same-day funnels; the Insights funnel card is gone).
- Migration `0011_saved_funnels` (`analytics_funnels`); `0010` stays unused.
  Applied to the shared local database only. Next free number: `0012`.
- `GET /v1/dashboard/funnel` extended (JSON steps with route/property filters,
  `window`, `breakdown`; adds `stepConversion`, `medianSeconds`, `segments`,
  `capped`); new `GET /v1/dashboard/funnels`; dashboard
  `POST/PATCH/DELETE /api/funnels` (admin, same-origin). No env vars, cron or
  Vercel config changes.
- Typecheck, lint, tests (including the `logly_test` SQL fixture against the
  in-memory spec) and the dashboard build pass. `seed-funnel-qa.ts` seeded a
  gnd-shaped project and saved funnel locally and its numbers match over the
  local collector. The real components were browser-checked at desktop and
  375px through a temporary unauthenticated route (removed); the
  authenticated `/funnels` page still needs an operator sign-in to view.
- Consumer findings (guide row 6): gnd has no quote events; school-clerk and
  halaal-coperative send only visits; plot-keys and after-service milestones
  are server events without a `visitorId`; ewatrade storefront works today.
- Follow-ups: best-attempt entry (any step-1 occurrence) if retried flows
  matter; custom date ranges; funnel trends over time.

## Retention — 2026-11-24

- Status: committed locally on `main` (`85cc8d1`), unreleased (feature 5 of
  the 8; held for the coordinated release; nothing pushed, deployed, migrated
  in production or published).
- [Retention](../features/retention.md),
  [ADR 0017](../decisions/0017-retention-cohorts-first-entry-event.md).
- New read endpoint `GET /v1/dashboard/retention`; new page `/retention`
  (sidebar "Retention"). No migration (`0010` unused), env vars, cron or
  Vercel config changes.
- Typecheck, tests (including the `logly_test` SQL fixture that checks the
  query against the in-memory spec for every range, surface and returning
  event) and the dashboard build pass; lint passes for the retention files
  (full-repo lint was failing only on the funnel session's in-progress files).
- Checked against the local stack with a seeded `retention-qa` project
  (900 visitors over 13 weeks, web and mobile, `signup` returns, 3 releases):
  the collector endpoint returns 200, and 400 for a bad range or surface.
  The real components were browser-checked at desktop and 375px (7d, 5w, 12w)
  through a temporary unauthenticated local route (removed, never
  committed); no console errors or page overflow. The authenticated
  `/retention` page, its filter links and event picker still need an operator
  sign-in to view.
- Follow-ups: a daily activity rollup if volume grows; optional
  `visitKind = "new"` cross-check for web cohort entry.

## Mobile app-version adoption — 2026-11-24

- Status: committed locally on `main` (`b58bfe5`), unreleased (held for the
  coordinated 8-feature release; nothing pushed, deployed or migrated).
- Feature 4 of the 8: [app-version adoption](../features/app-version-adoption.md),
  [ADR 0016](../decisions/0016-app-versions-latest-version-attribution.md).
- New read endpoint `GET /v1/dashboard/app-versions`; new page `/versions`
  (sidebar "Versions"). No migration (the reserved `0009` went to passkeys),
  env vars, cron or Vercel config changes.
- Typecheck, lint, tests (including the `logly_test` SQL fixture that checks
  the query against the in-memory spec) and the dashboard build pass. The API
  was checked against the local stack with a seeded `versions-qa` project
  (four release waves, stragglers folded into Other, Unknown, iOS/Android;
  a web-only project returns `mobile: false`). The real components were
  browser-checked at desktop and 375px through a temporary unauthenticated
  local route (removed, never committed); the authenticated `/versions` page
  and its web-only empty state still need an operator sign-in to view.
- Consumer findings (guide row 4): gnd sends correct versions but its store
  builds disable Logly; ewatrade never sends a build and its version is the
  static manifest `1.0.0`; halaal-coperative sends neither.
- Deploy markers (feature 2) are drawn on the adoption chart with the shared
  marker layer; checked with three seeded `versions-qa` releases.
- Follow-ups: OTA (`updateId`/`runtimeVersion`) adoption; a daily per-version
  rollup if mobile volume grows.

## Deploy markers — 2026-11-24

- Status: committed locally on `main`, unreleased (feature 2 of the 8; held for
  the coordinated release; nothing pushed, deployed, migrated in production or
  published).
- [Deploy markers](../features/deploy-markers.md),
  [ADR 0015](../decisions/0015-deploy-markers-signed-release-endpoint.md).
- Migration `0008_deploy_markers` (`analytics_releases`).
- New `POST /v1/releases`, `GET /v1/dashboard/releases`, and dashboard
  `GET/POST/DELETE /api/releases`. No env vars, cron or Vercel config changes.
- `@ishaqyusuf/logly-server` bumped to 0.4.0 in the repo (unreleased, not
  published): `release()`, `sendRelease`, `logly-release` CLI.
- Verified against the local stack: the built CLI recorded `v2.3.0` for
  `pages-qa-11240837`; a curl/openssl post returned 201, then 200 on retry;
  `GET /v1/dashboard/releases` returned both. Unit, route and SQL fixture
  tests pass. Visual browser QA of the chart markers and the Settings section
  is pending an operator sign-in in the local browser (creating a QA operator
  was not permitted).
- Follow-ups: markers on a future Pages trend chart; optional release
  filtering per environment in charts.

## Passkey operator sign-in — 2026-11-24

- Status: committed locally on `main`, unreleased (held for the coordinated
  release; nothing pushed, deployed or migrated in production).
- [Operator authentication](../features/operator-authentication.md#passkey-sign-in--2026-11-24-local-unreleased),
  [ADR 0014](../decisions/0014-passkey-operator-sign-in.md).
- Migration `0009_passkeys` (after `0008_deploy_markers`; next free is `0010`).
- New optional env vars `PASSKEY_RP_ID`, `PASSKEY_RP_NAME`, `PASSKEY_ORIGINS`;
  production needs none while `BETTER_AUTH_URL` is the production URL.
- Typecheck, tests and dashboard build pass; lint passes for the touched
  packages. Sign-in page browser QA passed. Pending with the user: apply `0009`
  locally, then register a passkey in Settings, sign out, and sign in with it
  (button and autofill), and remove it.

## Pages report and tracking-quiet alerts — 2026-11-24

- Status: committed locally on `main`, unreleased (held for the coordinated
  8-feature release; nothing pushed, deployed or migrated in production).
- Features 1 and 3 of the 8 approved: [Pages report](../features/pages-report.md)
  and [tracking-quiet alerts](../features/tracking-alerts.md),
  [ADR 0013](../decisions/0013-tracking-alerts-evaluate-on-read.md).
- Migration `0007_tracking_quiet_alerts` (next free number is `0008`).
- New read endpoints `GET /v1/dashboard/pages` and
  `GET /v1/dashboard/tracking-alerts`; optional `projects[].trackingAlert` on
  overview. No env vars, cron or Vercel config changes.
- Typecheck, lint, tests, dashboard build and local SQL fixtures pass. The API was
  verified against the local stack with a seeded `pages-qa-*` project
  (templates, raw paths, `/other`, null routes, a `stopped` alert). Visual
  browser QA of `/pages`, the Overview banner, selector badge and Settings
  history is pending an operator sign-in in the local browser.
- Follow-ups: email alert channel (needs a scheduled trigger, see ADR 0013);
  per-route drill-down; session-based entry/exit if visitor-day is too coarse.

## SDK route templates — 2026-11-24

- Status: merged to main and in the 2026-11-24 production deploy (`7c81d51`).
  Published to npm 2026-11-24: logly-core, logly-next and logly-server 0.3.0,
  logly-native 0.1.0 (first release).
  See [ADR 0012](../decisions/0012-sdk-route-templates.md).
- `logly-core` and `logly-native` record routes as templates (`/orders/:id`)
  by default, with project rules through `routeTemplates`.
- Core and native tests, typecheck and lint pass. Released as 0.3.0 (npm had
  0.2.x; native publishes for the first time), with a `CHANGELOG.md` shipped in
  each SDK package. After publish, GND can drop its own route allowlist in
  `packages/events/src/policy.ts` and move the rules into `routeTemplates`.

## Overview redesign — Pulse — 2026-11-13

- Status: released 2026-11-13. GitHub `main` `a61d85e` (merge of `0f05664`
  with origin's visitor-country work); Vercel production deploy succeeded. The
  collector ships inside the dashboard (`app/v1/[...path]`), so one deploy
  carried both. Production QA on Afterservice: 7d and 24h ranges, Events tab,
  previous-period overlay, top-event changes, and live hourly buckets render
  with no console errors.
- Workshop `logly/dashboard/overview-redesign` compared four directions; the
  user selected 02 Pulse (revision `fe34711a`). Metric tabs drive one chart with
  a previous-period overlay; top events, recent events, and collection health
  sit below.
- Additive optional overview read fields (`trendGranularity`, `previousTrend`,
  per-bucket `newVisitors`/`returningVisitors`, top-event `previousCount`) are
  documented in `../api/contracts.md`; the dashboard tolerates their absence.
- Workspace tests, typecheck, and dashboard production build pass. Browser QA
  against the local stack covered desktop and 375px, tab/keyboard/URL state,
  range switching, tooltip, and empty states.
- Arrival lag now shows in the largest readable unit (`29769` seconds reads
  as `8.3 hours`); released with commit `2161615`.

## Generic group analytics — 2026-10-01

Deployed to production 2026-11-24 (`7c81d51`); migration 0005 was already
applied by the 2026-11-13 release. SDKs published to npm the same day. See
[delivery checklist](2026-10-01-generic-group-analytics.md). Logly provides
generic group/user/property filtering; EwaTrade and Halaalvest derive trusted
business context. Product signing-secret configuration and live traffic QA remain.

## Vercel-style team → project header selector — 2026-09-23

- Status: deployed to production 2026-11-24 (`6f2ef6a`, released in `7c81d51`); browser visual QA still pending.
- Three HTML proposals are in `.design/vercel-header/`, with the two-column selector marked as recommended and implemented.
- The header now owns the organization/project selector on desktop and mobile. The sidebar retains page navigation and operator identity. URL-backed project scope and organization/project creation remain available.
- Typecheck, tests, dashboard production build, and focused Biome lint pass. Full-repository lint remains blocked by existing formatting in untouched `packages/db/src/queries/index.ts`. No API or database contract changed.

### [EwaTrade and Halaalvest integration completion](2026-09-22-portfolio-integration-completion.md)

- Status: both project tasks active. Each owns
  Dashboard, Marketing, and Android integration, Logly project separation,
  production verification, and local/GitHub main integration.
- Shared Overview Date serialization failure repaired in `82b1eb5`, deployed,
  and authenticated Chrome verified across 24h, 7d, and 30d.

## Overview date presets — 2026-09-15

- Status: implemented locally.
- The selected-project Overview now offers URL-backed 24h, 7d (default), and
  30d presets. Complete-window KPIs, prior-window comparison, trend, top events,
  and recent-event preview follow the chosen range. Collection health keeps its
  independent 24-hour receipt window.
- The full workspace typecheck and test suite and diff check pass. The date
  control and low-traffic KPI state were visually checked in the app's real
  styles at desktop and 390px, including all selected states and no phone-width
  overflow. The normal local launch was unavailable because Docker Engine did
  not start; the isolated preview route was removed after QA.

### [GND Mobile Platform Analytics And OpenPanel Replacement](2026-09-12-gnd-mobile-platform-analytics.md)
- Status: Complete. Production web and mobile canaries, country map/list/flag QA, Android/iOS usage QA, responsive screenshots, deployments and scoped GND branches are recorded in [the report](gnd-mobile-platform-analytics/production-qa-2026-09-13.md).

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

## Consumer release progress — 2026-09-10

Halaalvest marketing/dashboard, Ewatrade marketing and SchoolClerk marketing have been promoted after successful remote builds. Ewatrade dashboard is building; SchoolClerk dashboard local validation continues after declaring its missing Tailwind PostCSS dependency. Exact release IDs and isolated commits are in `analytics-expansion/report.md`. Native client releases and owner-deferred interactive acceptance remain outstanding.

Latest: Ewatrade dashboard is also promoted (five web targets released). SchoolClerk dashboard production build passes; separate TypeScript validation is running because its unchanged production config skips build-time types.

## Native analytics release — 2026-09-12

All six verified web targets are promoted. Ewatrade Android analytics update group `6f1125ea-6214-4583-a695-d5d35484074a` is published on production from the live binary base. Halaalvest Android initial production build `37b6d3b5-580d-4108-9aaf-6aa0b2736833` finished successfully and produced the versionCode 9/runtime 0.1.0 production AAB. Interactive acceptance remains the next owner-directed phase.

Release branches are pushed for all three consumer repositories. The requested implementation and release-artifact phase is complete; store submission and interactive consumer acceptance remain outside this phase.

## Country analytics production QA — 2026-09-12

Halaalvest production generated a located browser arrival and Logly displayed United States, 1 visit, 100.0% with the correct active heat-map polygon. Country flags, explicit visit labels and the fewer-to-more heat legend are deployed in `dpl_CjsARB4jVyf5NKiKMFYRHk7inKJf`. Desktop and 390px mobile QA pass without overflow or console errors. See `country-map/production-qa-2026-09-12.md`.

## Project key reissue — 7 October 2026

Completed: additive credential issuance for the existing EwaTrade Dashboard and Marketing projects. Production deployment `dpl_AJBtoENjZbPnxkRBoxvDuEadFhkZ` is Ready on logly-chi.vercel.app. Focused tests (9 tests / 31 assertions), full typing, scoped formatting, package builds, dashboard build and desktop/390px checks pass. Both local EwaTrade env entries are filled and verified: own-project credentials pass authentication before disallowed-origin rejection; cross-project credentials fail authentication. No test events were ingested. No schema change, migration, existing-key revocation or commit. Unused issuance attempts remain active. Evidence and changed-file inventory: `/Users/M1PRO/Documents/code/ewatrade/.brain/tasks/2026-10-07-logly-project-key-reissue.md`.

## Afterservice visit countries — 2026-10-24

Completed and production-verified. Fresh Afterservice website and dashboard
visits both show Nigeria (NG) in Logly.
Added opt-in Cloudflare SDK forwarding and event table/detail country labels.
Afterservice uses published 0.2.1 plus a tracked Bun patch. Existing country
schema/Insights reports are reused. Validation and rollout notes:
`country-map/afterservice-2026-10-24.md`.

## Breakdown read endpoint — 2026-11-12

Implemented locally; see [task](2026-11-12-breakdown-endpoint.md). Release waits
on the generic-groups release plus user approval for migration, deploy, and npm.

## Afterservice visit countries — 2026-10-24

Completed and production-verified. Fresh Afterservice website and dashboard
visits both show Nigeria (NG) in Logly.
Added opt-in Cloudflare SDK forwarding and event table/detail country labels.
Afterservice uses published 0.2.1 plus a tracked Bun patch. Existing country
schema/Insights reports are reused. Validation and rollout notes:
`country-map/afterservice-2026-10-24.md`.
