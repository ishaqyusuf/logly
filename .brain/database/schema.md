# Database Schema

## Generic groups (local, 2026-10-01)

`analytics_events.groups` is non-null JSONB defaulting to `{}`. Each group has a
type, project/type-scoped HMAC key, and optional bounded scalar properties. Raw
group references are not stored. A GIN index supports group containment/type
queries; `(project_id, actor_id, occurred_at)` supports user investigations.
Existing events remain unattributed. Event properties reuse the existing JSONB
column, with exact scalar containment preserving null/missing/type semantics.

## Tables

- `analytics_organizations`: operator-owned project grouping and navigation
  boundary with an automatically generated unique slug.
- `analytics_projects`: project registry, origins, timezone, consent mode, retention, status.
- `analytics_project_keys`: hashed scoped credentials and revocation state.
- `analytics_events`: project-scoped events with pseudonymous visitor keys and bounded JSON properties.
- `analytics_daily_rollups`: identifier-free daily metric aggregates.
- `user`, `session`, `account`, and `verification`: Better Auth operator
  identity, sessions, credentials, and verification records.
- `passkey`: Better Auth WebAuthn credentials for operators (see below).

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
- Date bounds use typed Drizzle comparisons so timestamps are serialized for
  postgres-js. Overview comparison windows have an exclusive upper bound;
  the 2026-09-22 repair replaces a raw Date interpolation without schema changes.
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

## Country visit metadata

`analytics_events.country` is nullable text, storing normalized ISO alpha-2 country codes for browser visits and mobile app sessions. Existing rows remain null. The write boundary enforces the whitelist; server rows always receive null. The existing unique project/event ID constraint preserves country on retries. Complete-window country counts reuse the scoped visit aggregation; no additional index or retention contract is introduced.

## Mobile release metadata

`analytics_events.platform`, `analytics_events.app_version`, and `analytics_events.app_build` are nullable text columns. Mobile events require `ios` or `android` at validation; browser events may record `web`; server events remain nullable. Version/build values are bounded opaque release labels. Complete-window mobile session, installation, platform and version aggregates operate within the existing project, organization, date, event, source, platform and search scopes. The app-version adoption report (`/versions`, 2026-11-24) reads these columns with `visitor_key` and `occurred_at`; blank `app_version` is treated as unknown and versions sort semantically. No schema change.

## Breakdown indexes — 2026-11-12 (local)

- `analytics_events_project_name_occurred_idx` btree
  `(project_id, name, occurred_at)` serves name-filtered breakdown windows.
- `analytics_events_properties_idx` GIN `(properties jsonb_path_ops)` serves
  property-equality containment filters; the planner can combine it with the
  existing `(project_id, occurred_at)` index.
- Property breakdown dimensions and duration percentiles read
  `properties ->> key` per row inside the project/time window; no per-key
  expression indexes are created.

## Tracking-quiet alerts — 2026-11-24 (local, unreleased)

- `analytics_tracking_alert_state`: one row per project (PK `project_id`, FK
  cascade): latest `status`, `observed_events`, `baseline_events`, evaluated
  `window_start`/`window_end`, and `evaluated_at`, which doubles as the
  evaluation claim (upsert re-claims only rows older than 5 minutes).
- `analytics_tracking_alerts`: alert history (`severity` drop|stopped,
  `opened_at`, nullable `resolved_at`, counts at open). Partial unique index
  `analytics_tracking_alerts_open_idx` on `project_id where resolved_at is
  null` (one open alert per project); `(project_id, opened_at)` index for
  history.
- Both are identifier-free operational tables (counts only), deleted with the
  project. Retention cleanup does not touch them yet.

The Pages report adds no schema; it reads `analytics_events` through the
existing `(project_id, name, occurred_at)` index.

## Deploy markers — 2026-11-24 (local, unreleased)

`analytics_releases`: `id` uuid PK, `project_id` (FK `analytics_projects`,
cascade), `environment` (`production`|`preview`), `version`, `deployed_at`,
nullable `description` and `url`, `source` (`api`|`dashboard`), `created_at`.
Unique `analytics_releases_unique_idx (project_id, environment, version)` makes
recording idempotent; `analytics_releases_project_deployed_idx (project_id,
deployed_at)` serves chart and list reads. Operational metadata only, no
identifiers; deleted with the project.

## Operator passkeys — 2026-11-24 (local, unreleased)

`passkey` holds the Better Auth passkey plugin's credentials: text `id` PK,
optional `name`, `public_key`, `user_id` (FK `user.id`, cascade), `credential_id`,
`counter`, `device_type`, `backed_up`, optional `transports`, `created_at` and
`aaguid`. Indexes: `passkey_user_id_idx` and unique `passkey_credential_id_idx`.
Only public keys are stored; nothing here enters analytics payloads. The table
is auth-only and deleted with the operator.

## Saved funnels — 2026-11-24 (local, unreleased)

`analytics_funnels`: `id` uuid PK, `project_id` (FK `analytics_projects`,
cascade), `name` (1–80 characters, trimmed), `steps` jsonb (2–8
`{ event, route?, property?: { key, value } }`, validated by
`normalizeFunnelSteps` before writes), `conversion_window` (`1h`|`1d`|`7d`|`30d`),
`created_at`, `updated_at`. Unique `analytics_funnels_project_name_idx
(project_id, name)`; at most 50 rows per project, enforced on create. Operator
configuration only, no identifiers; deleted with the project.
