# ADR 0009: Generic group snapshots on analytics events

Date: 2026-10-01. Status: accepted for local implementation.

The owner requested business/user attribution across Logly, EwaTrade and
Halaalvest without dedicated business/client columns. Use optional generic
`groups[type] = { key, properties }`, alongside existing actor identity and
scalar event metadata. A business is one consumer-defined group type.

Store immutable JSONB group snapshots and hash each key using the collector
secret plus project and type. Preserve a bounded display name independently of
identity. Reuse parameterized JSONB containment for exact typed matching and
the same predicates for paginated rows and full-window aggregates. A GIN group
index supports containment and type presence; actor lookup uses project/actor/
time. No profiles or business table is introduced.

Attribution is forward-only. App proxies authenticate signed snapshots from
trusted membership context; SDK state changes cannot retag queued history.
Client telemetry remains observational, not a business audit ledger. Future
merchant reporting requires server-side group authorization beyond these filters.
