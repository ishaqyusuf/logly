# Logly Brain

## Purpose

Canonical project memory for Logly product, architecture, implementation, and operating decisions.

## Current State

- Phase: production trustworthiness and the first external pilot.
- Primary surface: single-operator analytics dashboard.
- First integration: the Logly dashboard itself.
- Validation: packages built, tests/lint/typecheck passed, production dashboard
  built, and desktop/mobile interaction QA passed. Better Auth protection,
  owner bootstrap, sign-in, and sign-out also pass against an isolated database.
  Production health, unauthenticated route protection, and authenticated
  organization/project navigation are verified. A repeatable local Afterservice
  same-origin event round-trip and the full Afterservice MVP smoke pass. The
  coordinated `0.2.0` SDK release is published under `@ishaqyusuf`, installed
  from npm by Afterservice, and production-verified. Chrome confirmed both a
  browser `site_visit` and a newly discovered uncatalogued smoke event under
  Personal / Afterservice after the production collector cutover.
- Deployment: `https://logly-chi.vercel.app` in the `ishaqyusuf` account. A
  standalone Neon `logly` database now exists on the free `iad1` plan, and only
  its pooled URL is configured as the Vercel Production `DATABASE_URL` secret.
  The storage resource remains unconnected and no generated Neon environment
  variable bundle was added. All four reviewed migrations are applied, production
  auth runtime values are configured, and the guarded owner bootstrap completed.
  The Vercel project is Git-connected to `ishaqyusuf/logly`, uses `main` as the
  production branch, and has automatic Git deployments enabled. Its project
  build override matches `vercel.json`: `bun run deploy:prepare && bun run
  build:dashboard`.
- Production gates remaining: retention cleanup, truthful collection health,
  and a verified backup/restore procedure. Fail-closed configuration,
  full-scope aggregates, operator authentication, origin enforcement, and
  server-signature verification are implemented and deployed. Signal Desk and
  the Midday-derived Events workspace are live in production deployment
  `dpl_DfoLrrGviexgUp88ETcThV5WFNYN`.
- The first verified Git-triggered production run completed in deployment
  `dpl_GeFSJRRcQcv7qsZJns3qGrUpwa4j`, promoted automatically to
  `https://logly-chi.vercel.app`. Production health returned HTTP 200 and the
  protected Overview route redirected unauthenticated traffic to sign-in.
- Signal Studio is implemented locally as the mandatory selected-project
  workspace for Overview, Events, Live, Insights, and Settings. Projects is
  removed from navigation; the connected implementation is deployed through
  the verified GitHub-to-Vercel pipeline.

## Read Order

1. `SYSTEM_OVERVIEW.md`
2. `system/architecture.md`
3. `product/vision.md`
4. `decisions/0003-focused-portfolio-telemetry.md`
5. `features/first-party-analytics.md`
6. `features/organizations-and-projects.md`
7. `features/operator-authentication.md`
8. `tasks/in-progress.md`

Country visit heat map is live (commit `7f9e1ab`), with mobile/desktop QA, scoped SQL checks and explicit historical unknown locations. See `.brain/tasks/country-map/report.md`. Public Next adapter 0.2.1 was explicitly approved and accepted by npm on 2026-09-07; registry metadata and downloaded artifact are verified; existing consumer proxies need that forwarding update and deployment.
