# ADR 0003: Focused Portfolio Telemetry

## Status

Accepted.

## Context

Logly exists to provide one operator with the small set of trustworthy signals
needed across a portfolio of low-traffic products. General analytics platforms
add session replay, feature flags, experiments, unrestricted queries, and a
multi-service operating burden that Logly does not need.

## Decision

Treat Logly as a focused portfolio telemetry platform rather than a general
analytics or logging clone. Its durable scope is daily visitor tracking,
explicit typed domain and operational events, complete-window summaries,
collection health, project comparison, export, retention, and operator digests.

Keep the shared tracking module deep: callers learn a small interface while the
implementation owns consent, privacy signals, project-scoped identity, batching,
delivery, validation, and retries. Add a major capability or runtime adapter
only after at least two real integrations demonstrate the same need.

## Consequences

- Session replay, heatmaps, automatic capture, cross-project identity, feature
  flags, experimentation suites, arbitrary query builders, unrestricted logs,
  and raw stack traces remain out of scope.
- Product repositories retain typed domain wrappers and decide which events are
  worth collecting.
- Operational events must use registered names and bounded safe properties.
- Trustworthiness, privacy, and collection health take priority over adding new
  chart types or analytics breadth.
