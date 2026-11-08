# Oversight actor-read compatibility — 2026-11-08

- [x] Diagnose missing actor fields in production Logly event reads.
- [x] Add independent actor-read parser, row fields, SQL filter and summary match.
- [x] Preserve pending group work and all existing production source.
- [x] Production-derived typecheck and focused tests.
- [x] Deploy the narrow read contract and verify Oversight's live actor filter.

No schema, ingestion, credentials or raw identity changes. See
../api/actor-event-reads.md and afterservice's production rollout handoff.

Production `dpl_84r2BC4HGFdT6VTSFXcZav6gGJ49`; source `edf9681`. Baseline
`dpl_CRYYWr8cjfmuZY6DnugWSYdYHBdk` remains the rollback. All package typing
and optimized build pass. Live selected actor returns exactly two labelled
test events and matching summary counts; reset restores the full view. No
production migration/bootstrap or unrelated source rollout occurred.
