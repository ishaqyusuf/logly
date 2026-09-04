# ADR 0001: Standalone Logly Platform

## Status

Accepted.

## Decision

Build analytics as a standalone monorepo with a central collector and three reusable SDK packages. Product repositories integrate through the packages and same-origin routes instead of owning ingestion/storage.

## Consequences

- One maintained platform serves multiple products.
- Each product retains typed domain event wrappers.
- Operations, privacy, retention, backups, and SDK compatibility become owned infrastructure.
