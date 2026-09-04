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
