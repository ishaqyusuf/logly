# System Overview

## Purpose

Describe the runtime request flow.

## Flow

```text
product browser -> @ishaqyusuf/logly-core -> same-origin Next route
  -> @ishaqyusuf/logly-server -> Hono collector -> @logly/db -> Postgres
operator -> Better Auth -> Postgres session -> protected dashboard
protected dashboard -> collector read API -> summaries and event workspace
```

## Local Development

The `logly` shared local-infra profile loads `.env.local`, starts the
`logly-postgres` Docker service on port `55438`, and launches the dashboard and
collector through the shared Portless proxy at `logly.localhost` and
`api-logly.localhost`. Ports `4201` and `4202` are project-owned and do not
collide with Afterservice's `4100-4102` range.

With both profiles running, Afterservice's `bun run smoke:logly:local` sends a
unique event through `afterservice.localhost/api/analytics` and verifies the
persisted event through Logly's project-scoped read API. This is the repeatable
local pilot acceptance path and does not require an event catalog entry.
