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
