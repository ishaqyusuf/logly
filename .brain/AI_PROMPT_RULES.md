# AI Prompt Rules

## Non-Negotiable Architecture Rules

- Midday is the primary standard for dashboard pages, tables, sheets, forms, layouts, tRPC-style data composition, and loading/error states.
- Use shadcn standard components and patterns. Add wrappers for product behavior instead of modifying primitives.
- Apps orchestrate; packages own reusable behavior.
- Add `app/[...slug]/page.tsx` as a catch-all redirect to `/`.
- Analytics must remain project-isolated and data-minimal.
- Logly remains focused portfolio telemetry, not a general analytics or logging
  clone; preserve ADR 0003's explicit scope exclusions.
- Dashboard summaries use complete-window aggregates, never event-page rows.
- Production analytics fails closed and never substitutes demo data for an
  unavailable collector, database, or credential.
- Never ingest unrestricted logs, raw stack traces, secrets, form values, email
  addresses, raw authenticated IDs, or cross-project identity.

<!-- personal-coding-rules:start -->
## Global Personal Coding Rules

Agents must treat these global coding rule references as non-negotiable:

- `/Users/M1PRO/.me/coding-standards/global.md`
- `/Users/M1PRO/.me/coding-standards/nextjs.md`

Project-specific exceptions require an ADR in `.brain/decisions/` before agents may diverge.
<!-- personal-coding-rules:end -->
