# Logly Agent Instructions

## Brain Protocol

`.brain/` is the project memory and source of truth for architecture, product state, tasks, and implementation context. Treat Brain documentation as part of the definition of done for every meaningful change.

Before starting work:

- Read `.brain/BRAIN.md`, `.brain/SYSTEM_OVERVIEW.md`, `.brain/system/overview.md`, `.brain/system/architecture.md`, `.brain/engineering/ai-rules.md`, `.brain/engineering/coding-standards.md`, and `.brain/tasks/in-progress.md`.
- For feature work, read the matching feature document and related ADRs.
- For API or database work, read the matching files under `.brain/api/` and `.brain/database/`.

After code changes:

- Run a Brain documentation impact check.
- Update database, API, feature, decision, and task documents when their contracts change.
- Final responses must list updated Brain files or state why no Brain documentation update was required.

## Project Commands

- Package manager: `bun`.
- Dashboard: `bun run dev:dashboard`.
- API: `bun run dev:api`.
- Broad validation: `bun run typecheck`, `bun run lint`, `bun run test`, and `bun run build:dashboard`.

## Architecture Rules

- Midday is the primary dashboard and monorepo reference.
- Apps orchestrate; reusable logic belongs in packages.
- Use shadcn/Radix-style UI primitives and compose wrappers rather than modifying primitives for feature behavior.
- Never collect email addresses, raw authenticated user IDs, form values, or cross-project identity in analytics events.

## Vercel runtime and cost

- Keep stable public routes static where possible and check the Next.js build output when changing them. When adding request-time rendering, polling, proxy work, or a scheduled job, document its trigger and expected frequency.
- Use the dashboard's Next.js route handlers for dashboard-owned HTTP endpoints. When a handler and its caller share a deployment, reuse the authorized service within the process where possible. Preserve the collector's REST contracts for products and standalone consumers. Bound timeouts when crossing a service boundary.
- Scope the Next.js proxy to the paths it serves and preserve server-side session and collector credential checks. Keep authenticated analytics and preview data private. A shared public cache requires a documented key, TTL, invalidation rules, and isolation tests.
- Bound payloads, pagination, polling, retries, and concurrency. Skip retries for auth and validation failures. Preserve signed ingest, client delivery guarantees, and health checks. Document job ownership, timeout, overlap handling, and idempotency when introducing scheduled work.
- Review dashboard preview scope against the workspace graph when changing build configuration. Verify that shared dependencies and migrations rebuild the dashboard. Preserve a compatible rollback deployment when changing retention or release paths.
- Record runtime and build baselines when changing usage-sensitive paths. Compare invocation count, Active CPU per 1,000 calls, p95 latency, and errors for comparable routes, environments, and traffic windows where available. Use route templates and exclude customer payloads and credentials.
- Inventory deployed consumers, monitors, and jobs and verify them in preview before changing traffic routing or retiring an endpoint. Production and provider changes follow the existing authorization requirements.
