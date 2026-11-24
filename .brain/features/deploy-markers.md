# Deploy markers

Implemented locally 2026-11-24 (unreleased; ships with the 8-feature release).
See [ADR 0015](../decisions/0015-deploy-markers-signed-release-endpoint.md).

Records each product release and draws it on the dashboard's time-series charts
so a change in traffic or events can be tied to a deploy.

## Recording releases

- `POST /v1/releases` (collector): `{ project, version, environment?,
  deployedAt?, description?, url? }`. Same trusted-writer auth as server ingest:
  a `server-write` project key (or the global `LOGLY_SERVER_KEY`) as the bearer
  and `x-logly-signature` = hex HMAC-SHA256 of the raw body with that key.
  Contract: [contracts](../api/contracts.md#deploy-markers--2026-11-24-local-unreleased).
- Idempotent on project + environment + version: a repeat returns the stored
  release unchanged (`200`, `created: false`), so CI retries never move or
  duplicate a marker. A first post returns `201`.
- Bounds: body ≤ 4 KiB, version 1–100 chars with no spaces, description ≤ 280,
  http(s) URL ≤ 500, `deployedAt` at most 5 minutes in the future and 365 days
  back, 30 requests a minute per client IP (in-memory, per instance, like the
  events limiter). Disabled or unknown projects return 404.
- `@ishaqyusuf/logly-server` 0.4.0 (unreleased): `analytics.release(...)`,
  `sendRelease`, `releaseFromEnvironment`, and the `logly-release` CLI. The CLI
  reads `LOGLY_COLLECTOR_URL`, `LOGLY_PROJECT`, `LOGLY_SERVER_KEY`, takes the
  release from Vercel (`VERCEL_GIT_COMMIT_SHA` first 12 chars, `VERCEL_ENV`,
  first line of `VERCEL_GIT_COMMIT_MESSAGE`, `VERCEL_URL`) or GitHub Actions
  (`GITHUB_SHA`, commit URL) variables with `LOGLY_RELEASE_*` overrides, skips
  `vercel dev` builds, and only fails the build with `--strict`.
- Vercel deploy hooks are inbound (they trigger builds) and cannot notify
  Logly. Products use `"postbuild": "logly-release"` (marker at build end, also
  for builds that later fail to go live) or a GitHub Actions step after the
  deploy. The README of `packages/analytics-server` has the snippets and a
  curl/openssl example.

## Dashboard

- Overview (Pulse) chart and the Events "Event volume" chart draw a dashed
  amber line with a diamond flag on each bucket (UTC hour for 24h, UTC day
  otherwise) that contains production releases; the flag shows a count when a
  bucket has several. Hovering the bucket adds the releases (version, UTC time,
  description; up to 3 plus "+n more") to the chart tooltip.
- Charts show production releases only; Settings lists both environments.
- The Pages report has no time-series chart, so it has no markers.
- Settings → Releases (`#releases`): the 20 most recent releases with
  environment, source ("added manually"), time, description and link. Admins
  can add a manual marker (version, environment, local date-time, link,
  description) and delete any release. Manual markers use `POST/DELETE
  /api/releases` (same-origin, admin session) and are stored with
  `source = 'dashboard'`; the idempotency rule is the same.

## Runtime and cost

- No cron, polling or new env var. Overview reads releases in parallel with
  the overview read (one indexed query over `(project_id, deployed_at)`, ≤ 200
  rows). The Events chart reads `/api/releases` once per window (TanStack
  Query, 60s stale time). Settings reads 20 rows.
- Release reads are supplementary: on failure the charts render without
  markers.
