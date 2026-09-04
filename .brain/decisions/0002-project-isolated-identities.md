# ADR 0002: Project-Isolated Identities

## Status

Accepted.

## Decision

Never create a universal visitor identity. Persist only an HMAC-derived visitor key scoped to one project.

## Consequences

- The same browser across two projects appears unrelated.
- Cross-project behavioral profiles and joins are intentionally unavailable.
