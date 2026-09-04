# Database Schema

## Tables

- `analytics_organizations`: operator-owned project grouping and navigation
  boundary with an automatically generated unique slug.
- `analytics_projects`: project registry, origins, timezone, consent mode, retention, status.
- `analytics_project_keys`: hashed scoped credentials and revocation state.
- `analytics_events`: project-scoped events with pseudonymous visitor keys and bounded JSON properties.
- `analytics_daily_rollups`: identifier-free daily metric aggregates.
- `user`, `session`, `account`, and `verification`: Better Auth operator
  identity, sessions, credentials, and verification records.

## Rules

- Never store plaintext server keys.
- Never store raw email addresses or browser local IDs.
- Operator email is permitted only in the Better Auth user table for login and
  communication; it must never be copied into analytics tables or events.
- Account passwords are stored only as Better Auth password hashes.
- Event IDs are unique per project for idempotency.
- Every project belongs to exactly one organization. Project slugs remain
  globally unique because the public collector envelope identifies a project by
  slug before credential verification.
- Dashboard totals and unique-visitor counts aggregate the complete requested
  project/time window, never the bounded event-detail page.
- Event-detail queries apply organization/project/search/name/source/date/sort
  conditions in SQL and return cursor metadata for 10–100 row pages (50 by
  default). Filter options are discovered from stored event rows, not a manual
  catalog.
- Daily rollups are identifier-free, idempotent, and replace repeated raw-event
  scans for portfolio trends and digests.
- Retention cleanup deletes expired raw events according to project policy while
  preserving permitted identifier-free rollups.

## Current Gaps

- Summary totals, 14-day trend, and top-event values use SQL aggregates over
  the complete requested project scope; event detail is independently paged.
- TODO: implement idempotent daily-rollup and retention-cleanup jobs.
- Production Postgres and both reviewed migrations are deployed; a verified
  backup-and-restore process remains pending.
