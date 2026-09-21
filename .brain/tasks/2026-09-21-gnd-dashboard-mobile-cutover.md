# Task: GND Dashboard And Mobile Analytics Cutover

## Status
Done

## Priority
High

## Created Date
2026-09-21

## Last Updated
2026-09-21

## Global Ticket
- Ticket Position: 1/1

## Source Context
Delete the obsolete `gnd-web` Logly project and its historical data, create a dedicated `gnd-dashboard` project under the GND organization, connect only the main GND dashboard and existing Expo mobile app, configure their production environments, and verify both integrations. Other GND applications are explicitly deferred.

## Implementation Progress
- Completion: 100%
- Current Checklist: 10/10 — Complete
- Blockers: None

## Implementation Checklist
- [x] Lock the two-surface architecture, privacy boundary, canonical origins, and environment contract.
- [x] Audit the current Logly API-key/project capabilities and the live `gnd-web` / `gnd-mobile` configuration.
- [x] Update GND dashboard source and focused tests to use `gnd-dashboard` without disturbing unrelated work.
- [x] Verify the Expo mobile runtime still targets `gnd-mobile` through the GND API proxy and document how its URL boundary works.
- [x] Create `GND Dashboard` in the GND Logly organization with `https://gndprodesk.com` and `https://www.gndprodesk.com` as the exact allowed production origins.
- [x] Capture the one-time `client-ingest` credential and configure the GND dashboard Vercel project environment without exposing it.
- [x] Confirm `gnd-mobile` credentials and API proxy configuration remain intact; correct only proven drift.
- [x] Deploy the dashboard change and run fresh dashboard/mobile ingestion plus Logly workspace acceptance checks.
- [x] Delete the obsolete `gnd-web` project and confirm its workspace and historical data are gone.
- [x] Run focused validation, independent code review, Brain synchronization, and commit the scoped changes.

## Validation Evidence
- Pre-cutover audit found `GND Web` and `GND Mobile` under the GND organization.
- Logly project creation generates separate `client-ingest`, `server-write`, `read`, and `admin` credentials, displays plaintext once, and stores only hashes.
- Pre-cutover audit found no `LOGLY` variables on the GND dashboard Vercel project.
- Vercel identifies `www.gndprodesk.com` as the production domain; `gndprodesk.com` redirects there with HTTP 308.
- The mobile API project retains `LOGLY_MOBILE_PROJECT`, `LOGLY_MOBILE_PROJECT_KEY`, and `LOGLY_COLLECTOR_URL` in Production.
- EAS Production resolves `EXPO_PUBLIC_LOGLY_ENABLED=true`, `EXPO_PUBLIC_LOGLY_PROJECT=gnd-mobile`, and `EXPO_PUBLIC_LOGLY_ENDPOINT=https://api.gndprodesk.com/api/analytics/mobile`.
- The dashboard same-origin route now pins `gnd-dashboard` and the canonical `https://www.gndprodesk.com` origin independently of dealership configuration.
- Focused GND analytics validation passes: 5 tests, 15 assertions, 0 failures across route, native runtime, and privacy policy tests.
- Logly created `GND Dashboard` / `gnd-dashboard` with both apex and canonical `www` origins.
- The dashboard Vercel project now has a Production-secret `LOGLY_PROJECT_KEY` plus Production config for the collector URL, enabled flag, and `gnd-dashboard` project slug.
- GND commit `c95259bb1` was pushed to remote `master`; Vercel deployment `5uhaJBLxxwxtAw4ZUSHmnoMuKCQM` completed successfully.
- An authenticated production Dashboard visit produced one fresh browser `site_visit` in `gnd-dashboard`.
- The production mobile proxy accepted one privacy-safe Android `app_session` with `accepted: 1`, `duplicate: 0`, and database mode; Logly displayed it in `gnd-mobile`.
- The exact `gnd-web` row was deleted with one historical event and four credentials via foreign-key cascades; a post-delete query returned zero matches.
- The final GND project selector shows exactly GND Dashboard and GND Mobile.
- Independent review found no hard standards breaches or unresolved implementation defects. One non-blocking positional-parameter maintainability advisory remains for the small route factory.
- Frozen Bun lockfile verification passed after adding the dashboard `@gnd/events` importer entry.

## Deferred Scope
- Dealership, storefront, `apps/web`, messaging extension, and any other GND surfaces.
