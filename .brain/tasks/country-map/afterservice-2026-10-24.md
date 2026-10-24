# Afterservice country forwarding and event visibility

Deployed and production-verified, 2026-10-24. Both fresh Afterservice website
and dashboard visits display Nigeria (NG) in Logly.

## Changes

- Next SDK: explicit `trustCloudflareCountry`, off by default. Opted-in
  Vercel deployments prefer CF visitor country; missing/invalid CF stays
  unknown, direct Vercel uses its own edge country, other runtimes forward
  none. No IP, body country or incoming `x-logly-country` override is used.
- Afterservice: released Next 0.2.1 + tracked Bun patch + shared website/
  dashboard route option. Core/server versions and core IndexedDB patch stay.
- Logly: country flag/name/code (or Unknown) in Events/Live rows and Context
  detail. Saved table layouts put the pinned actions column last. Existing
  country schema, complete-window map/list and deduplication are unchanged.

## Verification

- Afterservice analytics tests: 12 pass; analytics package typecheck passes.
- `bun run smoke:logly:country` in Afterservice: actual shared POST handler →
  local authenticated Logly collector → PostgreSQL → detail/summary reads.
  Nigeria survives a GB retry, CF missing location stays null despite US
  Vercel header, event-body FR country ignored. Fixture rejects non-local
  collectors and models Vercel only in the test process. Local QA rows retained.
- `bun --env-file=/dev/null ../local-infra-kit/bin/with-env.ts --profile logly
  --mode local -- bun packages/db/scripts/verify-country.ts`: pass.
  Retained scoped fixture `country-map-qa-mvm1wgrx`: NG 100, US 100, GB 50,
  unknown 1, with retry/scope/acquisition/funnel regression checks.
- Focused SDK/country tests: 15 pass; full suite: 96 pass; full Logly typecheck and production
  dashboard build pass.
- Chrome: existing local operator sign-in; Events visit filter, Nigeria/US/GB
  column labels, Country detail; 390×844 mobile detail has no horizontal page
  overflow. Existing map/list shows 251 visits, 250 located, 1 unknown; Nigeria
  selection shows 100 visits / 39.8%. No browser console errors.
- Final Afterservice full workspace typecheck passes (13 tasks).

Screenshots: Afterservice task visualization directory
`/Users/M1PRO/.codex/visualizations/2026/10/24/01a16cb4-1da2-7740-8e68-250c75edd905/`
contains `logly-country-desktop.png` and `logly-country-mobile.png`. These show
local fixture data, not production traffic.

## Production release — complete

All targets were rebuilt from their exact live Vercel production source
bundles, with only this task's country changes overlaid. Unrelated unfinished
checkout work was excluded. The isolated Logly production baseline passed
78 tests, full workspace typecheck and a production build; its existing
build command was retained and no migration ran. The 96-test working-tree
result above includes other local features not released in this task.

- Logly: `dpl_CRYYWr8cjfmuZY6DnugWSYdYHBdk` promoted to
  `https://logly-chi.vercel.app` (previous `dpl_AJBtoENjZbPnxkRBoxvDuEadFhkZ`).
- Afterservice website: `dpl_DELDv8FpopNs797knFSMkkArZciH`.
- Afterservice dashboard: `dpl_ArgCRKAwFDhVpejQ9MBHkXwBskQF`.

All builds reached Ready, all three final alias IDs were verified, and website,
dashboard sign-in and Logly health returned HTTP 200. No npm publication,
credential/environment change, database migration, or unrelated source release
was performed. The new private Chrome verification window was closed afterward.

Authenticated production Logly shows two real new-browser visits in project
`afterservice`, both with country `NG` / Nigeria:

| Origin / route | Event ID | Occurred, Africa/Lagos |
| --- | --- | --- |
| Website `/` | `41de2d2e-d92a-4bc7-91a9-a76d39cec96e` | 2026-10-24 08:17:58 |
| Dashboard `/sign-in` | `b132a834-8cb3-451e-bfcb-c3323fe9ac66` | 2026-10-24 08:18:42 |

Both table rows and Context details show the Nigerian flag/name/code. No
country headers or synthetic analytics requests were supplied for this test.
Historical rows remain Unknown; the 7-day visit count rose from 72 to 74.
No production Logly browser console errors were recorded.

Production screenshots in the same visualization directory are
`logly-country-production.png` (website detail) and
`logly-country-production-visits.png` (both fresh rows and historical Unknown).

The full rollout evidence and baseline IDs are also recorded in Afterservice's
`brain/handoffs/2026-10-24-country-tracking-release.md`. Exact source snapshots
and changed-file hashes remain in `/private/tmp/country-release-record.json`
and `/private/tmp/country-release-{website,dashboard,logly}`.

## Country-only source branch

`codex/visit-country-tracking` contains only this country SDK option, country
row/detail display, saved-column-order compatibility, tests and country docs.
It is based on GitHub main. The unrelated group-analytics, project-key and
header-selector work is excluded. The shared checkout and its index are
preserved; this push does not replace the isolated production release above.
