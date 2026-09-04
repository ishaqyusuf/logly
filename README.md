# Logly

Logly is a small first-party analytics platform for a portfolio of low-traffic products. It includes a central collector, a Midday-style operations dashboard, and reusable browser, Next.js, and server SDK packages.

## Repository

```text
apps/
  api/            Hono collector and read API
  dashboard/      Next.js dashboard and same-origin SDK proxy
packages/
  analytics-core/ Framework-independent browser SDK and contracts
  analytics-next/ React provider and Next.js route adapter
  analytics-server/ Trusted server event and dashboard read client
  db/             Drizzle schema and query boundary
  ui/             Shared shadcn-style UI primitives
  utils/          Pure shared utilities
```

## Start

```bash
bun install
bun run build:packages
cp .env.local.example .env.local
bun run dev
```

The shared local-infra launcher starts Docker PostgreSQL and both Portless-backed
development surfaces:

- dashboard: `https://logly.localhost`
- collector API: `https://api-logly.localhost`
- PostgreSQL: `127.0.0.1:55438`

Apply migrations and create the local-only operator before the first sign-in:

```bash
bun --env-file=.env.local --filter @logly/db db:migrate
bun --env-file=.env.local --filter @logly/auth bootstrap:owner
```

The standard `db:*` commands use the shared safety router and require a local
`.env.production` identity before connected non-production operations can run.
Direct package commands above are intentionally limited to the Docker database
declared in `.env.local`.

Run another product such as Afterservice through its own shared local-infra
profile at the same time; Logly uses separate ports and Portless routes. The
dashboard only falls back to demo data in development when its collector
configuration is absent or unreachable.

## SDK packages

Logly stays intentionally thin and ships three packages:

```bash
bun add @ishaqyusuf/logly-core @ishaqyusuf/logly-next @ishaqyusuf/logly-server
```

- `analytics-core`: browser-safe event contracts, visitor-day state, and batching.
- `analytics-next`: React provider and same-origin Next.js route adapter.
- `analytics-server`: trusted server writer and read client.

Browser projects use a same-origin route. The route holds a project-scoped
`client-ingest` key, trusted backends use `server-write`, and reporting uses
`read`. No secret key belongs in a `NEXT_PUBLIC_*` variable.
