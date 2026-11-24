# Generic group analytics delivery

Status: deployed to production 2026-11-24 (`7c81d51`); SDK 0.3.0 npm publish pending.

- [x] Generic SDK identity, group and metadata context with immutable snapshots.
- [x] Collector validation, project/type-scoped hashing and generic JSONB storage.
- [x] Generated migration 0005, applied to local PostgreSQL only.
- [x] Events group/actor/typed-property filters and matching full-window SQL totals.
- [x] EwaTrade and Halaalvest trusted-context adapters, reviewed by another agent.
- [x] SDK/Logly unit tests, typecheck and production dashboard build.
- [x] Local SQL fixture: 150 events, multiple pages, duplicates, exact scalar
  matching, actor scope, two businesses, and cross-project separation.
- [x] Authenticated Chrome: business labels, filter + property count 60,
  reload persistence, desktop and 390px layout, no page errors.
- [x] Cross-repository proxy contract check: both signed issuer payloads pass
  Logly validation; raw IDs and proof absent; tampered proofs rejected.
- [x] Collector migration 0005 in production (applied 2026-11-13; code released 2026-11-24).
- [ ] Configure each product's private signing secret and deploy its adapters.
- [ ] Verify real dashboard and Android traffic after release.
- [ ] Separately implement merchant-authorized reporting UI/API when requested.

Root SQL verification is reproducible via `packages/db/scripts/verify-groups.ts`
against the guarded local Logly database (port 55438). It leaves clearly named
synthetic QA projects for browser inspection. No production database changed.

Review corrected byte-limit stalls, token-renewal queue loss, startup/reset
races, account relaunch identity, internal users without a tenant, clock skew,
and changed privacy signals. EwaTrade broad compiler validation also encounters
an existing unrelated `retail-ops-staff.ts` Prisma input type error; consult the
consumer feature document for its final validation report.

Halaalvest final acceptance: 40 focused tests / 177 assertions, all five package/
app typechecks pass. Final custom-event review added same-page expiry renewal
with bounded retry and disposal guards; its focused regression passes.
EwaTrade focused acceptance: 29 tests / 167 assertions and events package
typecheck pass. Both apps expose custom browser/mobile tracking helpers with
approved scalar metadata and signed audience/role precedence.
EwaTrade final API, Dashboard and Mobile full TypeScript runs each report only
the shared existing `retail-ops-staff.ts:1603` TS2322 error; no analytics
diagnostics remain. Consumer source review is accepted; release remains pending.

Full Logly lint also reports pre-existing errors in the untouched
`overview-range-filter.tsx` (ARIA role/format) and `project-workspace-server.ts`
(import order). Changed analytics files pass scoped lint. These unrelated
files were left intact.

## Brain documentation impact

Updated: `features/group-analytics.md`, `features/first-party-analytics.md`,
`api/contracts.md`, `api/endpoints.md`, `api/permissions.md`,
`database/schema.md`, `database/relationships.md`, `database/migrations.md`,
`decisions/0009-generic-event-groups.md`, `tasks/in-progress.md`, this task,
and root `ai/plan.md`. Consumer feature/API/ADR/task documents record their
own implementation and configuration boundaries. EwaTrade's original generic
plan/backlog now distinguishes implemented attribution from future profiles,
advanced property queries and merchant reporting.
