# ADR 0005: Organizations Group Projects Without Multi-Operator Tenancy

- Status: Accepted
- Date: 2026-09-01

## Context

The operator needs Vercel/OpenPanel-style organization and project selection,
while Logly is intentionally a thin OpenPanel replacement with one authenticated
owner. Adding a complete membership, invite, billing, and tenant-isolation model
would expand the product before the Afterservice pilot proves that need.

## Decision

- Add `analytics_organizations` and require every analytics project to reference
  one organization.
- Backfill existing projects into a seeded `Personal` organization.
- Treat organizations as dashboard navigation and reporting groups in this
  phase; the authenticated admin can access all of them.
- Keep project slugs globally unique because SDK envelopes and credentials use
  the project slug as the public lookup key.
- Use the GND hover-expanding sidebar composition and place the combined
  organization/project selector in its module-selector position.

## Consequences

- The UI gains the requested organization/project workflow without changing
  SDK initialization or existing project keys.
- A future microsaaS team model can add memberships and organization-scoped
  roles without moving projects again.
- Allowing duplicate project slugs across organizations would require a
  deliberate collector-envelope/version migration and is not included here.
