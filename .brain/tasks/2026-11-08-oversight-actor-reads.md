# Oversight actor-read compatibility — 2026-11-08

- [x] Diagnose missing actor fields in production Logly event reads.
- [x] Add independent actor-read parser, row fields, SQL filter and summary match.
- [x] Preserve pending group work and all existing production source.
- [x] Production-derived typecheck and focused tests.
- [ ] Deploy the narrow read contract and verify Oversight's live actor filter.

No schema, ingestion, credentials or raw identity changes. See
../api/actor-event-reads.md and afterservice's production rollout handoff.
