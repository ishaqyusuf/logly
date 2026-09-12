# Implementation Plan

## Proposed: project event registry — 2026-09-08

User requested a plan for making untriggered events available to filters and
funnels. Source audit and phased proposal are recorded in
`.brain/tasks/event-registry-plan.md`. Proposed approach: optional build-time
manifest synchronization plus automatic observed-event discovery, independent
of occurrence counts. Planning only; no implementation or release started.

## Status

MVP complete. Production-trustworthiness follow-on is active.

## Objective

Build and deploy the first Logly MVP: a standalone analytics collector, reusable SDK packages, and a Midday-style dashboard that dogfoods the SDK.

## Contract

- [x] Inspect the source thread and Midday invoice workspace.
- [x] Select the monorepo and package boundaries.
- [x] Initialize the Project Brain.
- [x] Implement and test `analytics-core`, `analytics-next`, and `analytics-server`.
- [x] Implement the collector and database boundary.
- [x] Implement events/projects dashboard pages and global sheets.
- [x] Build, typecheck, lint, test, and browser-QA the dashboard.
- [x] Deploy to Vercel.

## Decisions

- Use apps for deployable surfaces and packages for reusable behavior.
- Use one project-scoped browser ID per product; derive the stored visitor key on the server.
- Keep demo mode read-only and never imply that serverless memory is durable storage.
- Use the Midday invoice workspace as the primary table/sheet/filter analogue.

## Risks

- Production persistence requires a Postgres `DATABASE_URL`.
- The first deployment cannot use a private read API until deployment secrets are configured.

## Next Step

Complete the production gates before accepting non-demo traffic:

- restorable production backup;
- rollups, retention cleanup, and measured collection health.

Then complete the Afterservice pilot and one meaningfully different second
integration before widening the shared SDK interface or product scope.

## Active Expansion: Durable Browser Delivery

- [x] Persist pending browser events in a bounded IndexedDB queue with a memory
  fallback and project-scoped transactional claims.
- [x] Send the first-ever visitor event immediately and batch later events by
  time, count, lifecycle, and reconnect triggers.
- [x] Retain stable event IDs across non-2xx and network retries.
- [x] Add opt-in pathname-only pageviews and safe declarative click tracking.
- [x] Preserve collector bulk insertion and reserve `site_visit` and
  `page_view` outside custom project catalogs.
- [x] Complete focused validation and production-build browser QA.
- [x] Publish the coordinated `0.2.0` packages in a separately authorized
  registry release.

## Active Expansion: Operator Authentication And Afterservice Pilot

- [x] Publish `@ishaqyusuf/logly-core@0.1.0`.
- [x] Prepare Core, Next, and server together as `0.2.0` with registry-safe core
  dependencies.
- [x] Publish the coordinated `0.2.0` release, then complete the Afterservice
  install.
- [x] Add Better Auth as a reusable Logly package backed by the existing Drizzle
  database boundary.
- [x] Add email/password sign-in, sign-out, session validation, auth routing, and
  dashboard protection using the closest Afterservice and Midday patterns.
- [x] Bootstrap the single owner account only after confirming the configured
  database is the intended Logly production database.
- [x] Keep email verification and password-reset delivery disabled in this pass;
  backlog the full Afterservice-style notifications/jobs/Resend/Trigger system.
- [x] Validate auth, packages, builds, and browser behavior before completion.

### Risks And Decisions

- Never print, persist in source, or document the bootstrap password.
- Operator email belongs only in the authentication tables; it must never enter
  analytics event payloads or cross-project identity.
- Production dashboard reads require both a valid Better Auth session and the
  existing server-only read credential.
- Sign-up is not exposed after the owner bootstrap; this remains a
  single-operator dashboard until an explicit multi-user decision is made.

## Dashboard Redesign Exploration

- [x] Audit the local dashboard and relevant authenticated reference products in
  Chrome.
- [x] Review reusable shadcn dashboard composition and permissively licensed
  chart/table references.
- [x] Produce three distinct interactive dashboard directions in `.design/`.
- [x] Review and score all three concepts; select **Signal Desk** as the
  recommended direction.
- [x] Expand the recommendation into Overview, Events, Projects, Settings, and
  system-state prototypes with responsive mobile navigation.
- [x] Validate all five screens at desktop, tablet, and phone widths; smoke-test
  event search/detail interactions and check browser console errors.
- [x] Make the concept/review navigation distinguish the Overview concept from
  the dedicated Events explorer and verify the Overview → Events route.
- [x] Obtain user approval before translating the design artifacts into the
  production dashboard.

### Design Boundary

- Keep Logly a thin analytics replacement: trend, top events, recent activity,
  project health, scoped credentials, and explicit system states.
- Do not add custom report builders, funnels, cohorts, replay, profiles, or
  automatic form/DOM capture during this redesign.

## Active Design Decision: Mandatory Project Workspace

- [x] Replace the portfolio-style dashboard brief with a mandatory selected
  project workspace.
- [x] Remove Projects from the proposed desktop and mobile navigation.
- [x] Design Overview, Events, Live, Insights, and Settings as connected pages
  inheriting the same selected project.
- [x] Enrich Events with complete filtered totals, event-name counts, trend,
  momentum, filters, row investigation, and event detail.
- [x] Produce six distinct interactive HTML directions in
  `.design/project-workspaces/` with a comparison board and design scorecard.
- [x] Browser-test project switching, filters, detail opening, desktop/mobile
  overflow, and console errors.
- [x] Obtain the user's preferred direction and implement Signal Studio in the
  production dashboard code.

### Implementation Guardrail

- Switching projects must invalidate project-scoped reads and must not flash the
  previous project's metrics.
- Full-window event summaries remain separate from paginated event rows.
- Keep the existing Midday-derived table core and URL filter architecture.
- Do not build portfolio analytics, replay, user profiles, funnels, cohorts, or
  cross-project identity as part of this redesign.

### Signal Studio Implementation

- [x] Resolve one canonical project workspace on every dashboard route.
- [x] Remove Projects navigation and redirect the legacy route to Settings.
- [x] Add complete-window event summary and project-scoped event-detail reads.
- [x] Add filter-aware event totals, trend, momentum, and event-name counts
  above the preserved Midday table core.
- [x] Add connected Live, Insights, and project Settings pages.
- [x] Run typecheck, full tests, lint, production dashboard build, and local
  authenticated Chrome QA with no console errors.
- [x] Deploy the Signal Studio implementation through Git and run production
  health and route-protection canaries.

## Git-Triggered Vercel Deployment

- [x] Verify `origin` is `ishaqyusuf/logly` and `main` is the GitHub default
  branch.
- [x] Connect the existing Vercel `logly` project to the GitHub repository.
- [x] Enable automatic Git deployments with `main` as production.
- [x] Align the Vercel build override with the repository deployment contract:
  run `deploy:prepare` before `build:dashboard`.
- [x] Commit and push the current release, then confirm Vercel created,
  completed, and promoted the Git-triggered production deployment.

## Active Implementation: Signal Desk Midday Migration

### Status

- [x] Approve Signal Desk for implementation.
- [x] Select Midday invoices as the table, filter, URL-state, and sheet
  architecture reference.
- [x] Inspect the existing Logly dashboard route, header, filters, event table,
  sheet, data loader, collector read routes, and database queries.
- [x] Inspect Midday's invoice route, header, search/filter, URL hooks, sheet
  split, table core, data table, columns, header, actions, bottom bar, skeleton,
  empty states, table settings, DnD, sticky-column, scroll, virtualization, and
  infinite-loading helpers.
- [x] Establish the focused validation harness.
- [x] Implement the migration contract below.
- [x] Run focused tests, typecheck, lint, browser QA, and final Midday
  conformance review.

### Reference Compared

- Target: `app/(sidebar)/*`, `components/{sidebar,header,event-*}.tsx`,
  `components/tables/{core,events}/*`, `components/sheets/event-sheet.tsx`,
  `hooks/use-event-*.ts`, `lib/dashboard-data.ts`, collector dashboard routes,
  DB dashboard queries, and analytics dashboard types.
- Midday source of truth: the complete invoice route/header/filter/sheet/table
  set required by `midday-migration-planner`, plus `components/tables/core/*`,
  table state/config utilities, and the DnD, sticky, scroll, virtual, infinite,
  sort, and settings helpers they use.

### Migration Principle

- Copy Midday's table core and interaction architecture, adapting only imports,
  semantic tokens, table ID, event-domain fields, and Logly's REST read boundary.
- Preserve Logly's explicit REST collector architecture. Do not introduce tRPC
  solely to imitate Midday; use an authenticated same-origin dashboard route
  and TanStack Query at the equivalent server-state boundary.

### Filesystem Plan

- Expand `components/tables/core/` to the Midday core file set.
- Add Midday-equivalent table helpers under `hooks/`, `utils/`, `store/`, and
  `actions/`, plus `portal.tsx`, `horizontal-pagination.tsx`, draggable header,
  resize handle, filter list, date filter, and column visibility.
- Replace the current event table/header/filter implementation with the Midday
  invoice structure adapted to events.
- Add a compositional `/overview` route and focused Overview components.
- Keep event details in the always-mounted global sheet and split header/content
  only where the read-only event domain benefits from it.

### Route And Data Plan

- `/overview` owns complete-window summary, time series, top events, recent
  events, and collection-health composition.
- `/events` loads URL filters/sort, table settings, first-page data, filter
  options, and the event explorer shell.
- Add cursor pagination, search, source/name/project/date filters, and sort to
  the collector/DB event read contract. Add a session-protected same-origin
  route for client-side infinite loading without exposing `LOGLY_READ_KEY`.
- Continue deriving summary cards and charts from complete-window SQL
  aggregates, never from paginated event rows.

### Header, Filter, Table, And Sheet Plan

- Match Midday's split header: search/filter at left, column visibility/export
  actions at right.
- Match its controlled dropdown/submenu filters, removable filter chips,
  keyboard focus/escape behavior, typed `nuqs` params, and date-range selection.
- Match its TanStack table core, stable row IDs, column visibility/sizing/order,
  drag reorder, resize, sticky columns, horizontal paging, virtualization,
  infinite loading, skeleton, empty/no-results states, row selection, and bottom
  bar. Adapt the bulk action to safe JSON copy only.
- Keep event row/detail actions URL-addressable through `eventId` and
  `eventType=details`; nested controls must stop row propagation.

### Projects, Settings, And Responsive Plan

- Apply the approved Signal Desk hierarchy to Projects and Settings while
  retaining organization/project query context and existing create-project
  flow.
- Add Overview to desktop/mobile navigation and make `/` redirect there.
- Preserve 44px mobile targets, compact event-list behavior, and project-scoped
  privacy language.

### Intentional Midday Omissions

- Invoice create/edit/success forms, invoice mutations, payment state, and
  download/delete actions do not fit immutable analytics events.
- tRPC is omitted because Logly's documented collector contract is REST and the
  dashboard must not import API app internals. TanStack Query still owns client
  server-state pagination.
- Event mutation invalidation is not applicable because analytics events are
  immutable; refresh/infinite loading replaces mutation refresh behavior.

### Acceptance And QA

- Focused unit tests cover event-query parsing, cursor/filter behavior, and
  complete-window overview shaping at public module boundaries where practical.
- Dashboard/package typecheck, lint, tests, and production dashboard build pass.
- Authenticated local browser QA proves Overview, Events filters/sort/search,
  column controls, detail sheet, infinite table behavior, Projects, Settings,
  and mobile navigation with no console errors or horizontal page overflow.
- Final audit compares every applicable item above with the exact Midday files;
  unexplained divergence is unfinished work.

### Production Release

- [x] Re-run typecheck, lint, the full test suite, and the production dashboard
  build immediately before release.
- [x] Deploy the linked `ishaqyusuf/logly` Vercel project with its idempotent
  migration preparation step.
- [x] Verify production health, unauthenticated protection, authenticated
  Overview data, Events filtering/sorting, and the detail sheet.
- Deployment: `dpl_DfoLrrGviexgUp88ETcThV5WFNYN`, aliased to
  `https://logly-chi.vercel.app`.

## Active: Portfolio analytics expansion (2026-09-07)

Implementation tickets and acceptance checklist: `.brain/tasks/analytics-expansion/plan.md`.
Decision: `.brain/decisions/0006-portfolio-analytics-expansion.md`.
Acquisition reporting starts first, followed by same-day funnels, observed collection health, Logly deployment, and the five consumer tracking surfaces. No consumer website acceptance testing until the user requests it.

### Reporting implementation progress

- Acquisition SQL/demo contract and Insights cards implemented; SQL checks and desktop/mobile screenshot QA pass.
- Observed collection health replaces placeholder delivery percentage; SQL populated/empty checks and desktop/mobile screenshot QA pass.
- Shared local dev filter syntax repaired so dashboard/API scripts match the launcher.
- Next: finish funnel reporting, validate combined release, deploy, then provision and integrate the five consumer analytics projects. See expansion plan for exact evidence and live tool handles.
- Same-day funnel report implemented with complete-window SQL and URL-owned selectors; four unit tests, real SQL fixtures, and desktop/mobile UI QA pass. Combined release passes 49 source tests, typecheck, lint and production build; Git deployment is next.
- Reporting release is live: `4f8cea9`, deployment `dpl_ELKo4hVahZmsWW6AXjVpeRzDDjL4`; production Chrome reads pass. Continue with consumer repository discovery, five production tracking projects and integration.

Portfolio checkpoint: five production namespaces created; three consumer source integrations and 21 focused tests complete. Broader app validation/deployment limitations and screenshots are recorded in `.brain/tasks/analytics-expansion/report.md`. Consumer live acceptance remains deferred.

## Country visit heat map

Implemented per `.brain/tasks/country-map/plan.md` and ADR 0007. Country ingestion, scoped report, mobile interactions and local SQL retry validation pass. Full test/typecheck/lint/build pass. Dashboard deployment and screenshot evidence are tracked in `.brain/tasks/country-map/report.md`. Public Next SDK 0.2.1 publication was explicitly approved and accepted by npm; registry metadata and downloaded artifact are verified.

Country heat map deployed as `7f9e1ab`; migration, health, authenticated empty/unknown production checks pass. SDK patch publication accepted by npm; registry artifact verified.

## Git deployment check — 2026-09-08

GitHub was three documentation commits behind local main. Pushed through
`ab46086` and verified the automatic Vercel deployment reached Ready in 56 seconds
and received the production domain. No Vercel configuration change was needed.
Evidence: `.brain/tasks/vercel-git-deployment-check.md`.

## Logo exploration — 2026-09-08

- User requested five distinct Logly identity options with variants.
- Using installed Agency Design / Brand Guardian and built-in Imagegen.
- Preparing Signal Notch, Event Thread, Aperture, Event Ledger, and Beacon boards in `.design/brand-options/`; selection pending.
- Scope is brand concept exploration; production UI remains as currently implemented.
- Completed: five PNG identity boards, exact prompts and responsive comparison gallery. Desktop/mobile browser checks passed. Selection and production vector refinement remain pending; see `.brain/tasks/logo-exploration.md`.

## Logo originality review — 2026-09-09

- Completed preliminary web screening of five original concepts and three replacement boards.
- Provisional design recommendation: A — Offset Register. Existing exact/near-name software businesses make the Logly name unresolved.
- Evidence, limitations, artwork and ranking: `.design/brand-options/revision-2/REVIEW.md`; Brain record: `.brain/tasks/logo-exploration.md`.
- No production identity change; no worldwide uniqueness or legal clearance claimed.

## Offset Register implementation — 2026-09-09

- [x] User selected A — Offset Register; retain the Logly working name.
- [x] Shared vector/wordmark in @logly/ui; sidebar, mobile header, sign-in, favicon and Apple icon integrated.
- [x] UI package compilation and focused lint pass.
- [x] Public sign-in desktop/mobile and icon QA completed; brand contract recorded in `.brain/features/brand-identity.md`. Authenticated sidebar QA remains unverified because Docker is unavailable.

Production dashboard build passed, including static generation of both icon routes (2026-09-09).

### 2026-09-10 consumer release continuation

Four existing web targets have successful promotions: Halaalvest dashboard/marketing, Ewatrade marketing, SchoolClerk marketing. Ewatrade dashboard remote build is in progress. SchoolClerk dashboard uses its own verified live base and is rebuilding after an explicit locked Tailwind PostCSS dependency fix. See `.brain/tasks/analytics-expansion/report.md` for release IDs and validation. Native client releases and interactive acceptance remain outstanding; no visual UI changes in this release continuation.

Latest checkpoint: Ewatrade dashboard promoted successfully. SchoolClerk dashboard full typecheck now passes; isolated commit `8c00cd6` is staging on its existing Vercel project. Confirm Ready before promotion; do not infer success from upload completion.

### 2026-09-12 native release checkpoint

SchoolClerk dashboard is promoted, completing all six verified web releases. Ewatrade Android OTA is published from an analytics-only branch rooted at its live binary commit. Halaalvest Android production build `37b6d3b5-580d-4108-9aaf-6aa0b2736833` finished successfully from the clean analytics branch and produced the versionCode 9/runtime 0.1.0 AAB. The requested implementation and release-artifact phase is complete; preserve the owner's separate interactive acceptance phase.

### 2026-09-12 country analytics production acceptance

A Chrome visit to Halaalvest marketing reached Logly as a United States arrival in `halaalvest-web`. Production Insights now shows the country flag, explicit `1 visit · 100.0%`, a fewer-to-more heat legend and count-relative map shading. Desktop and 390px mobile QA, selection behavior, console checks, focused tests, repository validation and deployment `dpl_CjsARB4jVyf5NKiKMFYRHk7inKJf` pass. Evidence: `.brain/tasks/country-map/production-qa-2026-09-12.md`.
