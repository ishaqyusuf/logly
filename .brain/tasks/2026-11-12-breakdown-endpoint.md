# Breakdown read endpoint (Oversight phase 2)

Status: implemented and locally verified, 2026-11-12. Not published or deployed.

Context: Oversight reads EwaTrade assistant-channel and dashboard-usage
analytics from the `ewatrade-dashboard` project with a project-scoped read key
and needs turns per day by `assistant_channel`, distinct hashed actors and
businesses, success/failure by name, and p50/p95 of `duration_ms`.

- [x] `parseBreakdownQuery` strict contract (`packages/utils/src/breakdown.ts`).
- [x] Complete-window grouping-set SQL (`packages/db/src/queries/breakdown.ts`).
- [x] `GET /v1/dashboard/breakdown` collector route behind read middleware.
- [x] `createAdminClient().breakdown()` in `@ishaqyusuf/logly-server`.
- [x] Migration `0006_breakdown_indexes.sql` (not applied beyond a disposable DB).
- [x] Tests: parser invalid input, collector 400/401, client encoding, and SQL
  fixtures for totals, distinct counts, percentiles, daily series,
  `(other)`/`(none)`, filters, and project/organization isolation.
- [ ] Release: depends on the unreleased generic-groups work (`0005`, group
  filters). Then apply 0005 and 0006, deploy the collector, publish
  `@ishaqyusuf/logly-server` — each needs user approval.
- [ ] Optional dashboard same-origin proxy when a dashboard view needs it.

SQL fixtures run only when `LOGLY_BREAKDOWN_TEST_DATABASE_URL` names a local
database whose name ends in `_test`; they create and drop their own schema:

    LOGLY_BREAKDOWN_TEST_DATABASE_URL=postgres://postgres@127.0.0.1:<port>/logly_breakdown_test \
      bun test packages/db/src/queries/breakdown

The event registry plan (`event-registry-plan.md`) was not implemented: it
requires a new table, backfill, manifest sync, and UI, so it is not small.
