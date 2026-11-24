# API Permissions

## Group-filter boundary

Group discovery and filtered event reads retain existing operator session and
project credential checks. Groups are analytics dimensions, not memberships or
authorization rules. Merchant-facing reads must later derive and enforce tenant
scope on the product server; never expose a Logly project read credential or
trust a submitted group key as evidence of access. Consumer proxies derive
actor/group snapshots from server-authorized identity and verify signed context.

## Key Scopes

- `client-ingest`: same-origin browser proxy ingestion only.
- `server-write`: trusted server event ingestion.
- `read`: dashboard queries.
- `admin`: project and key management.

Project credentials are verified by hash and must be active, unrevoked, and
unexpired. Browser proxies use `client-ingest`, trusted writers use
`server-write`, and project-filtered dashboard reads use `read`. Environment
keys remain bootstrap/operator fallbacks and are never shipped to browsers.

## Origin Policy

Browser ingestion must match a project allowlist. Server writes use signed requests and never rely on browser origins.

The collector verifies `analytics_projects.allowed_origins` before accepting a
`client-ingest` batch. Reflecting an origin is never treated as authorization.

## Server Request Integrity

- `server-write` requests authenticate with a scoped credential and include a
  body HMAC signature.
- The collector verifies `x-logly-signature` with constant-time comparison
  before accepting the batch.

## Dashboard Access

- Dashboard pages require a server-validated Better Auth operator session.
- Collector dashboard endpoints remain bearer-key APIs; the dashboard uses its
  server-only read key after operator session validation.
- Project read keys remain restricted to their own project.
- Organization and project creation require the current single-operator admin
  session. Organization membership and invitation permissions are deliberately
  deferred until Logly becomes multi-operator.

## Failure Mode

- Missing production database, collector, ingest key, or read key configuration
  must fail closed and expose collection health to the operator.
- Demo mode requires an explicit non-production flag. It must not silently mask
  collector or credential failures.

## Project key reissue — 7 October 2026

Only a server-validated single-operator admin session can issue keys. The query binds both organization and enabled project before inserting only a SHA-256 hash. Existing keys are retained. Neither errors nor analytics include credential values; responses prohibit caching. Credential verification matches the requested hash directly rather than searching an arbitrary first ten keys.
