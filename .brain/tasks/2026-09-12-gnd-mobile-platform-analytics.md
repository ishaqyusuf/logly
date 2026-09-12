# Task: GND Mobile Platform Analytics And OpenPanel Replacement

## Status
Complete

## Priority
High

## Created Date
2026-09-12

## Last Updated
2026-09-13

## Global Ticket
- Ticket Position: 1/1

## Source Context
Add first-class Android and iOS analytics to Logly, expose mobile usage, visits,
events, versions and geography in the dashboard, integrate GND web and Expo
mobile as separate projects, and remove GND's OpenPanel implementation.

## Implementation Progress
- Completion: 100%
- Current Checklist: 8/8 — Complete
- Blockers: None

## Implementation Checklist
- [x] Define the privacy-safe mobile event, visit, platform, version and geography contracts.
- [x] Implement mobile ingestion, persistence, filters and complete-window aggregates in Logly.
- [x] Implement the responsive Android/iOS usage dashboard and event detail presentation.
- [x] Build and test a reusable Expo/React Native analytics adapter.
- [x] Replace GND OpenPanel web tracking and remove its dependency and environment contract.
- [x] Integrate GND Expo mobile session, screen and explicit event tracking.
- [x] Provision and configure separate `gnd-web` and `gnd-mobile` production projects.
- [x] Run final tests, responsive web/mobile QA, code review, documentation, screenshots and scoped commits.

## Validation Evidence
- Initial audit confirmed GND has Android and iOS Expo targets, no native analytics runtime, and OpenPanel isolated in `@gnd/events` for web callers.
- Initial Logly audit confirmed the current envelope accepts only `browser` and `server` sources and has no platform/version fields.
- Contract and in-memory aggregation tests pass for Android/iOS metadata, daily app sessions, platform/version counts and mobile country visits.
- Additive migration `0004_long_warbird.sql` applied locally. The guarded SQL fixture verified 3 sessions, 6 events, 3 installations, Android/iOS and version breakdowns, country counts, acquisition isolation, and platform-filtered rows.
- Logly's full typecheck, lint, unit-test matrix and dashboard production build pass.
- GND `@gnd/events` lint, typecheck and four focused tests pass. OpenPanel has zero source, manifest or lockfile references. Mobile, dealership and API compiler logs contain no diagnostics for analytics-owned files; their broad checks retain unrelated pre-existing sales/order diagnostics.
- The authenticated Logly production account now contains organization `gnd` with projects `gnd-web` and `gnd-mobile`. Scoped credentials are stored in the GND Vercel projects, and EAS Production holds only the public mobile project and proxy endpoint configuration.
- Production canaries passed through the real GND boundaries: `gnd-mobile` accepted 4 events with 2 app sessions across iOS and Android, and `gnd-web` accepted 1 browser visit. Both reported Nigeria from the Vercel delivery edge.
- Authenticated production QA verified the world map, Nigeria flag, visit list, counts, percentages, Android/iOS split, app version/build breakdown and 390-pixel responsive layouts. See [the production QA report](gnd-mobile-platform-analytics/production-qa-2026-09-13.md).
- Logly deployment `dpl_96sWMrTpe48DiDTgDr1H7sM5thXc`, GND API deployment `dpl_5hsNq7h4N3aC3MMUX8RfS4MFD5FS`, and dealership deployment `dpl_EkTJ3sxtcyHxPHvowA4UNQQTMMTK` are Ready on their canonical production aliases.
- GND source is published on isolated branches `codex/gnd-logly-complete` and `codex/gnd-logly-api-prod`; remote `master` was left untouched because the local branch includes unrelated ahead commits.

## Implementation Plan

### Objective
Provide separately scoped GND web and mobile analytics, including Android/iOS
usage, app visits, events, versions and country reporting, while completing the
OpenPanel replacement.

### Assumptions
- A native visit is one `app_session` per project-local installation per UTC day.
- Country is inferred by the trusted collector boundary; GPS is never requested.
- GND business analytics screens are outside this telemetry replacement.

### Execution
1. Extend shared contracts and persistence with a `mobile` source and bounded platform/app metadata.
2. Add complete-window mobile aggregates and filters independently of event pagination.
3. Compose a responsive Insights report from existing shadcn primitives.
4. Add a reusable Expo-safe runtime with stable IDs, bounded persistence and explicit tracking.
5. Replace GND's `@gnd/events` OpenPanel implementation and add the mobile runtime at the app root.
6. Provision production projects and configure scoped credentials without exposing them in source.
7. Validate contracts, packages, apps and responsive UI, then document and commit the result.

### Skills List Used
- `plan`: implementation sequencing and acceptance criteria.
- `implement-with-progress`: canonical checklist and milestone reporting.
- `midday`: package, API, database and dashboard boundaries.
- `shadcn`: dashboard component composition.
- `monorepo-expo`: Expo runtime and package structure.
- `react-native-best-practices`: low-overhead native instrumentation.
- `fast-bun-monorepo-command-discipline`: narrow inspection and validation.

### Risks And Mitigations
- Retry duplication: retain stable event IDs and use collector idempotency.
- Private identity leakage: use project-scoped installation IDs and exclude raw user IDs/form data.
- Unrelated GND worktree changes: touch and stage only analytics-owned files.
- Production authentication: finish reviewable source and local validation before browser provisioning.
