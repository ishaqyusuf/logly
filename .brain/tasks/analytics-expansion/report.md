# Logly analytics expansion — implementation report

Logly is deployed at https://logly-chi.vercel.app (commit `4f8cea9`, Vercel Ready). Three reporting features are complete, tested and responsive. The five requested consumer namespaces are provisioned; consumer source integration is implemented locally, with deployment and interactive acceptance still pending.

## Reporting features

| Feature | Delivered behavior | Desktop | Mobile |
| --- | --- | --- | --- |
| Acquisition | Complete-window browser visit counts by referrer and UTM source | [Screenshot](screenshots/acquisition-desktop.png) | [390px screenshot](screenshots/acquisition-mobile.png) |
| Ordered funnels | 2–5 chronological steps within a project-scoped UTC visitor-day; conversions and drop-off | [Screenshot](screenshots/funnel-desktop.png) | [390px screenshot](screenshots/funnel-mobile.png) |
| Collection health | Stored arrivals, last receipt and measured lag; unknown delivery success stays unknown | [Screenshot](screenshots/health-desktop.png) | [390px screenshot](screenshots/health-mobile.png) |

49 Logly source tests, lint, TypeScript, package/dashboard production builds and guarded real-SQL verification passed. Chrome checked desktop/390px layouts without horizontal overflow and fresh-load console errors. Authenticated production verification and health/auth canaries passed.

## Consumer integrations

| Product | Production namespaces | Source coverage | Setup evidence |
| --- | --- | --- | --- |
| Halaalvest | `halaalvest-web`, `halaalvest-mobile` | Dashboard, marketing, Expo | [Screenshot](screenshots/halaalvest-projects.png) |
| Ewatrade | `ewatrade-web`, `ewatrade-mobile` | Dashboard, marketing, storefront, POS, Expo | [Screenshot](screenshots/ewatrade-projects.png) |
| SchoolClerk | `schoolclerk-web` | Dashboard, marketing, school-site | [Screenshot](screenshots/schoolclerk-projects.png) |

Afterservice-style shared packages own providers, privacy projection and credential-bearing proxies. Native adapters avoid browser globals, keep an installation-local random identifier in SecureStore, and retry bounded in-memory batches. Server keys never enter public/native configuration. Only coarse page/visit events are enabled; private route segments, query strings, authenticated identities, arbitrary properties and attribution fields are stripped. Consumer acquisition is therefore initially direct/unknown; business conversion instrumentation is outside this initial adapter.

Halaalvest: ten focused tests and package/dashboard/marketing/mobile typechecks pass. Both native adapters bundle successfully (two modules, about 3.6–3.7 KB), without importing the browser runtime. Ewatrade: ten focused tests and package/POS typechecks pass; broader checks exhausted default heap, the 8 GB mobile retry also exhausted its heap. SchoolClerk: seven focused tests and package/marketing typechecks pass; dashboard/site errors in current API/database/template paths prevent full-app green status. These checks send no consumer telemetry to production.

All three analytics packages pass scoped Biome checks and their final 27 tests. Production credential files are Git-ignored. No consumer page/UI layout was redesigned. The screenshots above prove namespace setup; interactive consumer website/native acceptance is deferred as requested. Analytics variables are configured on the six existing Vercel dashboard/marketing projects and both verified Expo production projects. Consumer deployments are not complete. No separate hosted targets were found in this Vercel account for Ewatrade storefront/POS or SchoolClerk school-site. All three consumer worktrees contain unrelated ongoing changes and have not been blanket committed or deployed.

## Brain documentation

Logly: `features/first-party-analytics.md`, `api/contracts.md`, `api/endpoints.md`, ADR-0006, `tasks/in-progress.md`, this report and `tasks/analytics-expansion/plan.md`.

Each consumer: `features/logly-analytics.md`, `decisions/2026-09-07-logly-product-analytics.md`, `api/endpoints.md`, `api/contracts.md`, and `tasks/in-progress.md`. No database schema changed.

## Next acceptance pass

Resolve the recorded full-app validation failures, release reviewed consumer changes using the configured production variables, and resolve hosting targets for the additional web apps. Then perform the owner-requested per-site/native runtime checks: one coarse navigation reaches only its own namespace, privacy signals suppress browser tracking, private payload fields are absent, and collector failures do not interrupt the product. Do not infer production traffic from source tests or project-creation screenshots.

## Configuration follow-up

Both native production Expo projects are verified as `@cipron-startups/halaalvest` and `@cipron-startups/ewatrade`. Their analytics switch and endpoint variables are configured; no native release was dispatched. Streaming proxy reads now enforce the 48 KiB limit before the entire body is retained, with exact-boundary and cancellation tests. All 27 focused tests and three package typechecks passed. Vercel configuration completed on all six verified existing projects: `halaal-vest-marketing`, `halaalvest-dashboard`, `ewatrade-marketing`, `ewatrade-dashboard`, `schoolify`, and `schoolclerk-dashboard`. All 30 variable additions succeeded, including sensitive server-side ingest credentials. These changes take effect only on a future consumer release.

## Handoff gate audit

The implementation artifacts, nine nonempty screenshots, and six-target/30-variable Vercel completion receipt were rechecked. The Logly working tree was clean before this audit note. The consumer live acceptance gate remains explicitly deferred by the owner and has remained unchanged across three consecutive goal turns. The goal is not claimed complete: consumer releases, broader validation issues and runtime acceptance remain recorded above. Further live testing requires the owner's promised follow-up.

## Country heat-map integration follow-up

The Logly heat map is live (`7f9e1ab`), and the user-approved `@ishaqyusuf/logly-next@0.2.1` release is registry-verified. The three consumer integrations use custom privacy-enforcing routes, so those routes now independently forward trusted Vercel country metadata to the collector. Coverage includes Halaalvest and Ewatrade web/mobile and SchoolClerk web. Browser country overrides and raw IP headers are ignored, while missing/non-Vercel metadata remains unknown.

All 32 focused tests pass: Halaalvest 12/50 assertions, Ewatrade 12/50, SchoolClerk 8/33. All three events-package TypeScript checks pass (Ewatrade disables incremental output to avoid sandbox writes). Changed proxy/test files pass Biome. No consumer UI changed, telemetry was not sent to production, and no consumer deploy or live acceptance is claimed. Each consumer's `features/logly-analytics.md`, `api/contracts.md` and `tasks/in-progress.md` records this additive metadata contract.

Previous goal turn made concrete progress by publishing and verifying the SDK; this continuation closes the custom consumer proxy gap. Consumer release/full-app validation limitations and the owner's deferred website acceptance boundary remain. Any interactive authentication is deferred while the owner is away from their laptop.

## Current-source handoff audit

Rechecked provider and proxy wiring in all requested consumer surfaces, including Halaalvest marketing's actual `apps/marketing/app` tree (not its `src/app` directory), both Expo root runtimes, Ewatrade storefront/POS and SchoolClerk school-site. All thirteen report/setup screenshots are present across the expansion and country-map folders. Analytics packages and proxy routes remain local, uncommitted integration files inside worktrees with unrelated ongoing changes; they are not represented as deployed.

The preceding goal continuation made progress by adding and testing country forwarding. The remaining owner-deferred consumer live acceptance gate is unchanged in this handoff audit; interactive authentication also remains deferred. No consumer website was opened or tested.

## Halaalvest isolated release — 2026-09-09

Both production targets were verified against Vercel metadata as source `4e8a66b9b66ef25df19bda7cd9fda077183fe5cc`. Worktree `/private/tmp/logly-rollout-halaalvest`, branch `codex/logly-portfolio-release`, commit `69d3a144` contains only analytics additions over that source. Original consumer worktree remains untouched. Dependencies resolve published Next adapter 0.2.1. Twelve analytics tests / 50 assertions, events-package typecheck, both web app typechecks, Prisma client generation from unchanged schema and both Next production builds pass. No database connection or migration was performed.

Production-configured deployments dispatched with `--skip-domain` for existing marketing and dashboard targets; build/promotion verification pending. Logs: `/private/tmp/halaalvest-logly-marketing-deploy.log` and `/private/tmp/halaalvest-logly-dashboard-deploy.log`. No native build or consumer live acceptance is claimed.

Staged remote build handles: dashboard `dpl_ey3CgBPmf9ZrVWFX847ecqMaajRg` (`halaalvest-dashboard-l03jny13n-ishaqyusufs-projects.vercel.app`), marketing `dpl_6PDXnBzM3KGtHjNxDMJPQpujN8xi` (`halaal-vest-marketing-c1z737gxu-ishaqyusufs-projects.vercel.app`). Upload commands completed; actual deployment state must be read from Vercel, not the CLI's optimistic no-wait message. Promotion has not been dispatched.

Remote checkpoint: dashboard build log reports `2 successful` tasks and `Build Completed in /vercel/output`, followed by `Deploying outputs`. Marketing remains Queued. Neither is promoted. Continue polling these existing deployment IDs; do not create replacements solely because the bounded wait expired. Local checks and remote dashboard build are progress; consumer acceptance remains deferred.

## Halaalvest promoted; Ewatrade prepared

Vercel confirmed both staged Halaalvest deployments Ready. Explicit promotions succeeded for dashboard `dpl_ey3CgBPmf9ZrVWFX847ecqMaajRg` and marketing `dpl_6PDXnBzM3KGtHjNxDMJPQpujN8xi`. This releases the web providers and independently scoped mobile ingest endpoint, not a native client build. Consumer interactive acceptance remains deferred.

Ewatrade dashboard and marketing production metadata both identify revision `7ea39432409642b7256282159c97d33d4cd1797c`. Isolated worktree `/private/tmp/logly-rollout-ewatrade` on `codex/logly-portfolio-release` now contains its analytics package, web layout/route wiring and Turbo variables with Next SDK 0.2.1. Dependency installation is running under exec session 68313; log `/private/tmp/ewatrade-logly-install.log`. Validation and deployment pending. Original worktrees remain untouched by this release preparation.

## Portfolio release checkpoint — 2026-09-10

Ewatrade isolated release `f5295dd8` passes both local Next production builds (including TypeScript), 12 analytics tests / 50 assertions and events-package typecheck. Production builds use an 8 GiB Node heap to avoid the baseline TypeScript memory limit. Marketing deployment `dpl_2SytsiCj9mt2GPtpLV3YXwwof66M` reached Ready and was promoted successfully. Dashboard deployment `dpl_AQs1vRHBnHw4D1xQ7cG3zgPJWnoB` is still Building; reuse this deployment handle.

SchoolClerk marketing was isolated from its verified live revision `439507a` in `/private/tmp/logly-rollout-schoolclerk-marketing`, commit `eb66317`. Eight analytics tests / 33 assertions, events-package typecheck and its Next production build pass. Deployment `dpl_4BicXmGVkC4ZBhdgJgp8BwFXs2yA` reached Ready and was promoted successfully to the existing `schoolify` project.

SchoolClerk dashboard has a different verified live revision, `caea67e`, isolated in `/private/tmp/logly-rollout-schoolclerk-dashboard`. Its eight analytics tests pass. A fresh production build exposed an undeclared `@tailwindcss/postcss` dependency in the existing dashboard CSS configuration. The dashboard now declares the already locked version 4.1.17; the build is being rerun. No dashboard deployment has been dispatched yet. No database schema changed or database connection was made during local Prisma generation/builds.

These releases do not establish interactive runtime acceptance. Consumer website/native acceptance and any interactive authentication remain deferred. Native client releases and extra web apps without verified hosting targets remain outstanding. Original consumer worktrees and their unrelated changes remain untouched by this isolated release phase.

Dashboard build follow-up: the sandboxed compiler stalled without output and was stopped. Running with subprocess permissions exposed the second implicit CSS dependency: dashboard CSS directly imports `tailwindcss`. Both `tailwindcss` and `@tailwindcss/postcss` are now explicitly declared at their existing locked 4.1.17 versions. Build session continues against this fix; no success or deployment is claimed yet.

Ewatrade dashboard deployment `dpl_AQs1vRHBnHw4D1xQ7cG3zgPJWnoB` subsequently reached Ready and promotion succeeded. Five existing consumer web targets are now promoted. SchoolClerk dashboard production build passes after declaring both CSS dependencies; its baseline Next configuration skips type validation, so a separate full dashboard typecheck is now running. Events-package typecheck passes. No SchoolClerk dashboard deployment is claimed yet.

SchoolClerk dashboard full TypeScript check now passes after declaring its two existing Radix imports at locked versions (dropdown-menu 2.1.16, primitive 2.1.3). Isolated release commit `8c00cd6` includes the analytics integration and four reproducible-build dependency declarations. Production staging was dispatched with `--skip-domain` against `schoolclerk-dashboard`; upload/build status remains to be verified from `/private/tmp/schoolclerk-dashboard-logly-deploy.log`. Its live domains have not been promoted by this step.

SchoolClerk dashboard staged handle: `dpl_CWkhebEZA22q9QmXxUZ674ottP4u`, URL `https://schoolclerk-dashboard-lvnhqr2vr-ishaqyusufs-projects.vercel.app`. Reuse this deployment for readiness verification; upload success is not a readiness result.
