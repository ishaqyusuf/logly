# Expand Logly reporting and portfolio integrations

Implement selected analytics capabilities and replace existing tracking in the requested products. User authorized implementation, production setup, and deployment on 2026-09-07; do not delete existing data. Consumer website acceptance testing is deferred until the user's follow-up.

## Files To Touch

Reuse:
- `packages/db/src/queries/index.ts`: scoped complete-window reporting queries.
- `packages/utils/src/index.ts`: reporting contracts and demo summaries.
- `apps/dashboard/src/lib/dashboard-data.ts`: authenticated collector read boundary.
- `apps/dashboard/src/app/(sidebar)/insights/page.tsx`: existing Insights route.
- Afterservice integration in `/Users/M1PRO/Documents/code/micro-startups/after-service`: inspected its `packages/events` provider/proxy pattern.

Extend / Update:
- Reporting contracts, DB aggregates, Insights components, and focused tests.
- Consumer-owned analytics wrappers, server proxies, deployment configuration and Brain docs after inspecting each repository's rules.

Create:
- Focused reporting components and tests where required.
- Separate production Logly projects: Halaalvest Web, Halaalvest Mobile, Ewatrade Web, Ewatrade Mobile, School Clerk Web, grouped under product organizations.

Avoid:
- Cross-project identity, raw user IDs, email, form values, replay, destructive data cleanup, and exposing server credentials in mobile/browser bundles.

## Execution Checklist

- [x] Inspect Logly and research official OpenPanel/Vercel features.
- [x] LGL-101: Acquisition reporting. Complete-window referrer and UTM-source visit counts, direct/unknown labels, empty states, scoped by project/time; desktop/mobile screenshots.
- [x] LGL-102: Ordered same-day conversion funnels. Select discovered events; count project-scoped visitor-days in chronological step order; show step conversion/drop-off; exclude anonymous server events; no cross-day retention claim; tests and screenshots.
- [x] LGL-103: Truthful collection health. Replace placeholder delivery-rate claims with observed persisted arrival timestamps/lag and clear unknown states; tests and screenshots.
- [x] LGL-104: Validate and deploy Logly. Full tests, typecheck, lint, production build, responsive browser QA and production verification.
- [x] LGL-105: Halaalvest integration. Confirm repository identity (`halaal-coperative` candidate), inspect Afterservice pattern, provision web/mobile project credentials in Chrome, implement privacy-safe web/native adapters and server proxy, validate build/unit behavior.
- [x] LGL-106: Ewatrade integration. Separate web/mobile tracking projects, migrate existing wrappers and validate build/unit behavior.
- [x] LGL-107: School Clerk web integration. Provision project, replace existing analytics, validate build/unit behavior.
- [x] LGL-108: Final screenshot report and integration handoff; leave consumer website acceptance testing pending user's follow-up.

## Validation

- Focused reporting and collector tests, plus real database aggregate verification.
- `bun run typecheck`, `bun run lint`, `bun run test`, `bun run build:dashboard`.
- Desktop and 390px mobile screenshots per feature; no horizontal page overflow.
- Inspect consumer scripts before choosing equivalent focused checks.

## Open Questions

None blocking initial implementation. Resolve canonical product names, domains, native proxy origins, and deployment targets from repository and authenticated production evidence.

## Research

- https://vercel.com/docs/analytics/filtering — referrer, route, campaign filters.
- https://openpanel.dev/features/funnels — ordered event conversion/drop-off.
- https://openpanel.dev/features/retention — evaluated; cross-day cohorts not selected because they would change Logly's visitor-day privacy boundary.

## Evidence / continuation checkpoint

- LGL-101 backend implemented: `AnalyticsEventSummary.acquisition` contains complete-window browser `site_visit` referrer/UTM-source breakdowns, preserving all existing summary filters and SQL project/organization joins. No schema migration.
- Added `apps/dashboard/src/lib/acquisition.test.ts`: project/date isolation, pageview/server exclusion, pagination independence (251 events), empty windows and missing attribution.
- `bun run build:packages` and `bun run typecheck` pass. Initial test placement in utils did not have Bun test types; moved to the dashboard's existing reporting test harness and rebuilt successfully.
- Next: implement a composed Insights acquisition panel using shared shadcn primitives; database-backed aggregate test; desktop/mobile screenshot QA. No UI changes or production deployment yet.
- Official shadcn card/badge docs fetched. Midday `packages/db/src/queries/reports.ts` and metrics card inspected. The current shared UI has Badge but no Card; add/reuse a shared Card for the reporting surface rather than another bespoke feature container.
- No sibling repository edits or production projects created yet. `halaal-coperative` is the candidate Halaalvest repo, pending identity confirmation from its docs.
- Focused validation: 8 tests pass across acquisition, existing summary, and DB value/pagination tests; repository lint passes; `git diff --check` passes. SQL execution against a real database remains explicitly unverified.

## 2026-09-07 UI and collection-health progress

- LGL-101 implemented locally: shared Card primitive and composed AcquisitionReport on Insights; no new tracking fields or dependency required. Authenticated Chrome checks covered empty and populated reports. SQL fixture verifies 251 arrivals independent of pageSize, organization/name/source/date isolation. Screenshots: `screenshots/acquisition-desktop.png` (1440px), `screenshots/acquisition-mobile.png` (390px). Mobile scrollWidth = viewport width, console errors = 0.
- LGL-103 implemented locally: `overview.collectionHealth` reports received event count in the last 24 hours, latest persisted arrival, average nonnegative receipt lag, and count of events whose client time exceeds receipt time. `deliveryRate` remains as a nullable compatibility field and returns null. Header says Stored event data instead of making an uptime claim. The UI explains lag and unknown delivery success. SQL fixture verifies populated and absent-project states. Screenshots: `screenshots/health-desktop.png`, `screenshots/health-mobile.png`; mobile overflow and console errors = 0.
- Added repeatable guarded SQL acceptance script: `bun --env-file=.env.local packages/db/scripts/verify-acquisition.ts`. It refuses non-loopback databases or ports other than 55438 and retains clearly named QA projects for screenshots without deleting data. Latest fixture: organization/project `acquisition-qa-mtrpg36l`.
- Local dev launcher fix: root dev:dashboard/dev:api use the supported space-separated `--filter` argument. Dashboard started under tool session 90457 at https://logly.localhost; collector was already listening on 4202. Do not restart without checking current process state.
- Migration conformance: Insights/Overview server routes compose report components, shared primitives stay in packages/ui, complete aggregates stay in packages/db, contracts/demo shaping in packages/utils. Midday reports/metrics patterns inspected. Dragging, editing, forms, sheets and bulk actions are intentionally omitted for these read-only fixed reports. Reused mandatory project URL context and server read boundary.
- Production deployment, LGL-102 funnels and all consumer migrations remain pending. Full lint/tests/build validation launched in tool session 35086; check its actual result before claiming success.
- Combined lint and production dashboard build passed (session 35086 completed exit 0). Broad test run passed 49 cases but included stale compiled test copies; source-only suite is run separately to avoid inflated counts. No generated data or files deleted.
- Source-only suite completed: 45 tests pass, 0 fail across 14 source files. Full lint, typecheck, package builds, production dashboard build, SQL fixture checks and responsive Chrome QA have passed for the current two reporting features.

## Funnel implementation and release candidate

- LGL-102 implemented: separate `packages/utils/src/funnel.ts` contract/validation/demo logic, `packages/db/src/queries/funnel.ts` complete-window SQL, credential-protected collector GET endpoint, server dashboard loader and composed native-select/Field/Card report. No schema migration or shared tracking expansion.
- SQL checks: 251 site_visit → 200 checkout → 100 paid; reversed paid → checkout yields zero second-stage conversions; wrong organization yields all zeros. Unit coverage includes timestamp ties, repeat names, missing identities, browser/server exclusion, project and UTC-day isolation, malformed steps/dates.
- UI flow tested by selecting three actual options and clicking Analyze funnel; URL and rendered counts verified. Desktop 1440px and mobile 390px screenshots saved as `screenshots/funnel-desktop.png` and `screenshots/funnel-mobile.png`; mobile horizontal width = 390. Earlier hot-reload errors occurred before UI package compilation; a fresh reload after compilation produced zero new console errors.
- Combined release candidate: 49 source tests pass, full lint and typecheck pass, production dashboard build passes. SQL fixture run succeeds. Browser viewport reset after QA.
- Next: commit/push this release through the existing Git-connected Vercel production pipeline, verify deployed features, then proceed to consumer projects. All five integrations still pending.

## Production release 2026-09-07

- Release commit `4f8cea9` pushed to main; Git-triggered production deployment `dpl_ELKo4hVahZmsWW6AXjVpeRzDDjL4` reached Ready and aliases `https://logly-chi.vercel.app`.
- Authenticated production Chrome confirmed Insights acquisition over real Afterservice data (11 arrivals), successfully executed site_visit → site_visit funnel (11 → 0), and Overview observed health (0 recent arrivals, unknown lag, historical receipt timestamp). No production console errors.
- Local and deployed reporting are complete; next is consumer provisioning/integration. Halaal-coperative `.brain/SYSTEM_OVERVIEW.md` confirms product name Halaalvest. Root AGENTS files for all three consumer repositories read. Initial searches found no OpenPanel wrappers in expected source paths; locate actual tracking before replacement.
- Important: `auto-service` is a different-looking skeleton and did not contain Logly imports; locate the real Afterservice repository before claiming its integration pattern has been copied.
- Production canaries: `/health` HTTP 200; unauthenticated `/v1/dashboard/funnel?project=afterservice&steps=site_visit,site_visit` HTTP 401. Used system curl trust after Python's local certificate bundle failed verification; no TLS verification bypass.

## Portfolio implementation checkpoint

All five production projects were created through authenticated Chrome under Halaalvest, Ewatrade and SchoolClerk organizations. SchoolClerk's canonical origin was independently verified against `apps/marketing/src/lib/social-metadata.ts` and authenticated Vercel domain ownership after automatic review initially requested stronger domain evidence; creation then succeeded.

- Halaalvest (`halaal-coperative`): dashboard + marketing web wrappers/proxies, native adapter/runtime, separate native ingest proxy; root production configuration and Turbo declarations. Eight package tests / 29 assertions and package/dashboard/marketing/mobile typechecks pass.
- Ewatrade: dashboard + marketing + storefront + POS web wrappers/proxies, native adapter/runtime, separate native ingest proxy; production configuration and Turbo declarations. Eight package tests / 29 assertions and package typecheck pass. Broad mobile/dashboard/marketing/storefront TypeScript exceeded Node's default heap; POS passed. The 8 GB mobile retry also exhausted its heap; no full-mobile typecheck pass is claimed.
- SchoolClerk: dashboard + marketing + school-site web wrappers/proxies; no native integration. Five package tests / 16 assertions, package and marketing typechecks pass. Dashboard/site checks report errors in current API/database/template work, outside the analytics paths; full-app validation is not green.
- No active OpenPanel source imports were found. SchoolClerk's unused Vercel analytics dependency remains installed, with no active import found. No existing data or unrelated work was deleted.
- Production namespaces and local `.env.production` wiring do not constitute deployed consumer releases. Hosted Vercel/EAS env propagation and consumer deployments are still pending. All three worktrees contain substantial unrelated ongoing work, so do not blanket commit or deploy them.
- Each consumer's `.brain/features/logly-analytics.md`, `.brain/decisions/2026-09-07-logly-product-analytics.md`, `.brain/api/endpoints.md`, `.brain/api/contracts.md` and `.brain/tasks/in-progress.md` document the exact contracts, verification and outstanding rollout.
- Screenshots: `halaalvest-projects.png`, `ewatrade-projects.png`, `schoolclerk-projects.png`. These prove production project setup, not consumer runtime acceptance.

Ticket checkmarks denote source integration/provisioning and the documented focused checks. They do not clear the consumer deployment or full-app validation limitations in the report. Final analytics-package Biome checks and all 21 tests pass after formatting/lint fixes. Production credential files are Git-ignored in all three repositories.

## Verified configuration follow-up

All 30 analytics variables added successfully across the six existing Vercel dashboard/marketing targets; both verified Expo production projects also have the two public native analytics variables. Consumer deployment and deferred live acceptance are not complete. Streaming-cap checks strengthen each proxy; 27 tests and all three package typechecks pass. Halaalvest/Ewatrade/SchoolClerk worktrees currently have 895/907/112 entries respectively, so unrelated work cannot be included in an analytics release. Separate hosted targets for Ewa storefront/POS and SchoolClerk school-site were not listed in the inspected Vercel account.
