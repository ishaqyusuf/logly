# API Contracts

## Generic group context (local implementation, 2026-10-01)

Events optionally accept `groups: Record<string, { key: string, properties?:
Record<string, string | number | boolean | null> }>`. Maximum five group types,
snake_case types up to 64 characters, nonempty keys up to 128, and up to 20
bounded scalar properties per group. Existing optional actorId remains. Group
and actor references are hashed at the collector within project scope; group
hashing also includes type. Old clients without groups remain valid.

Event list and summary accept `groupType`, `groupKey`, `actor`, `propertyKey`,
and `propertyValue`. Group keys/actors are stored opaque references returned by
reads. A key requires a type. Property key/value must occur together and value
is JSON-encoded scalar, e.g. `"pos"`, `3`, `true`, `null`. Invalid filters
return 400. All filters combine with AND and existing project/time scope.
Event rows/details include actorId and groups. Summary filters cover every
aggregate query including the previous comparison window.

`GET /v1/dashboard/groups?project=...&q=...` returns
`{ data: [{ type, key, name }], hasMore }`, up to 50 matches. The latest received
group name is a label; matching always uses the full key. Search matches names,
types and opaque keys case-insensitively. No current-profile traits are queried.

## Event Envelope

Required: event ID, project slug, event name, event version, source, occurrence time. Browser events may include a project-local browser ID, pathname-only route, referrer host, campaign fields, and bounded registered properties.

`site_visit` and `page_view` are reserved system events. Other structurally
valid event names are accepted automatically for the authenticated project and
appear in reporting without pre-registration. Browser batches preserve the
original occurrence time and event ID across delivery retries.
The batch SDK descriptor uses the public package identity
`@ishaqyusuf/logly-core` and coordinated package version.

## Limits

- Maximum 25 events per batch.
- Browser delivery packs lifecycle-safe batches below 48 KiB.
- Maximum 20 properties per event.
- Property strings are capped at 256 characters.
- Event names use lowercase snake case or a project namespace.

## Project Creation

The authenticated operator submits a project name and 1–10 HTTPS production
origins separated by commas or new lines and selects an organization. The
server derives the lowercase
kebab-case slug deterministically from the project name; an explicit slug is
accepted only for API compatibility. Origins are normalized and de-duplicated
before storage, and any invalid entry rejects the complete request. Event names
require no project-setup catalog. Plaintext scoped credentials are returned
only in the successful creation response and only their hashes are persisted.

## Organization Creation

The authenticated admin submits only an organization name. The server derives
the lowercase kebab-case slug, rejects an invalid or duplicate name, and
returns the created organization. Organizations group dashboard projects; they
do not yet introduce memberships, invitations, billing, or cross-operator
tenancy.

Dashboard reads accept optional `organization` and `project` slugs. Supplying
both applies both boundaries, and the project must belong to the organization.
Dashboard page routing resolves these optional API inputs into one mandatory
selected-project workspace before rendering analytics.

Overview reads accept optional `range=24h|7d|30d`. The Overview page defaults
to `7d`, keeps the choice in its URL, and applies it to complete-window visitor
and event totals, top events, trend, and the recent-event preview. KPI change
compares against the immediately preceding equal window; zero-denominator
comparisons return null and display as no prior-period data. Without `range`, the
collector retains its existing all-history totals and 14-day trend for other
dashboard shell reads. `collectionHealth` always measures receipts in the last
24 hours, independently of the selected overview range.

Ranged overview responses also carry these additive, optional fields (added
2026-11-13 for the Pulse Overview; older collectors omit them and the
dashboard degrades to an unavailable-series state):

- `trendGranularity`: `hour` for `24h`, otherwise `day`. Buckets are UTC.
  Day keys are `YYYY-MM-DD`; hour keys are `YYYY-MM-DDTHH:00:00Z`.
- `trend[]` is zero-filled from the bucket containing the window start through
  the bucket containing now. Each point adds `newVisitors` and
  `returningVisitors`, counted as `site_visit` events with that `visitKind`
  (the same definition as the KPI totals).
- `previousTrend[]`: the immediately preceding equal window, zero-filled with
  the same bucket size and index-aligned with `trend[]` (same length).
- `topEvents[].previousCount`: that event name's count in the preceding window.

Without `range`, the trend stays the 14-day daily series (now zero-filled and
with visitor-kind counts) and `previousTrend`/`previousCount` are omitted.

## Dashboard Event Reads

Event-list reads accept optional `organization`, `project`, comma-separated
`projects`, `names`, `sources`, and `platforms`, plus `q`, ISO `start`/`end`, `sort`,
`cursor`, and `pageSize`. Supported sort fields are `occurred_at`,
`event_name`, `project`, and `source`, with `asc` or `desc` direction. Page size
is clamped to 10–100 and defaults to 50. Responses use
`{ data: AnalyticsEventRow[], meta: { cursor: string | null } }`.

Filter-option reads return distinct project slugs, discovered event names,
valid sources, and discovered platforms for the selected organization/project scope. Dashboard browser
code calls the authenticated same-origin `/api/dashboard/events` proxy; the
server-only read credential never enters the browser bundle.

Event-summary reads require `project` and accept the same `organization`,
`names`, `sources`, `platforms`, `q`, `start`, and `end` filters as the event list. They
return totals and breakdowns for the complete matching window, independently
of page size or cursor. The comparison window immediately precedes the current
window with equal duration and does not overlap it.

Event-detail reads require both an event ID and project slug. An ID from another
project returns not found, including when opened through URL-owned sheet state.

### Acquisition summary (local implementation)

Event-summary responses now include `acquisition: { totalVisits, referrers,
campaignSources }`. Each breakdown contains `{ label, count }` rows sorted by
count descending then label. Only browser `site_visit` events contribute;
pageviews and server activity do not inflate arrival counts. The same project,
organization, date, name, source, and search filters apply. Missing referrers
are `Direct / unknown`; missing UTM sources are `Unattributed`. These are
visitor-day arrival counts, not sessions or unique people across days.
The database aggregates the complete matching window independently of event
pagination. No migration or additional event collection is required.

### Observed collection health (local implementation)

Overview responses include `collectionHealth` with `recentEvents` (receipts in
the past 24 hours), `lastReceivedAt` (latest persisted receipt, ISO UTC or null),
`averageLagSeconds` (receipt minus occurrence time for recent receipts with
nonnegative lag, or null), and `clockSkewEvents` (recent receipts timestamped
ahead of receipt). All queries preserve organization/project boundaries.
`deliveryRate` is retained as a nullable compatibility field and returns null;
no success denominator exists for events that never reach the collector.
Demo health is unmeasured. No persistence migration is needed.

### Same-day funnel reports

`GET /v1/dashboard/funnel` requires `project` and comma-separated `steps` (2–5
valid event names); accepts organization and ISO start/end. Defaults to the
last 30 days; windows over 90 days or invalid/reversed dates return 400.
The existing dashboard read credential middleware applies. SQL uses full
project-scoped pseudonymous visitor keys, browser events only and UTC days.
Each stage requires a strictly later occurrence in the same day; repeated
names therefore require another event. Counts are independent of row paging.
Response: `{ start, end, steps: [{ name, visitors, conversion, dropOff }] }`.
Visitors means visitor-days, conversion is percent of first-stage entrants,
and dropOff is the count lost from the preceding stage. No cross-day joining.

### Country visit summary

Event-summary responses add `geography: { totalVisits, unknownVisits, countries: [{ code, name, count }] }`. Codes are ISO 3166-1 alpha-2; names use English display names. Rows sort by count descending then name. Browser `site_visit` and mobile `app_session` events contribute, across the complete matching project/organization/date/name/source/platform/search scope, independent of pagination. Unknown locations stay in the denominator. No event-body location field is introduced.

After existing client-ingest authentication and origin checks, the collector accepts `x-logly-country` from the credential-authenticated product proxy. Web and mobile product proxies may read only their trusted hosting edge's country header. They ignore direct client country overrides. The collector validates the exact country whitelist and ignores its own geographic edge header; server-write requests never supply country. Country records the delivery network, not residence. No IP/GPS/city is persisted; retries retain the first accepted location.

### Mobile platform summary

Client-ingest batches accept `source: mobile` only with `platform: ios | android`; browser events may use `platform: web`. Mobile rows may include bounded `appVersion` and `appBuild` strings. The dashboard summary returns complete-window `mobile: { sessions, installations, events, platforms, versions }`, where sessions count `app_session`, installations count distinct project-scoped visitor hashes, and platform/version rows include counts and shares. Event detail exposes platform, version, and build. The dashboard can filter event lists and summaries by platform without mixing those filters into acquisition reporting.

## Project key reissue — 7 October 2026

`POST /api/project-keys` accepts `{ organization, project, scope }`, with bounded lowercase slugs and `client-ingest | server-write | read | admin`. Success is 201 `{ key: { scope, value } }`; failures are 400 invalid input, 401 unauthorized, 403 foreign origin, 404 unavailable project, or sanitized 500. All responses disable caching. Each request adds one credential and never rotates/revokes existing credentials. Plaintext remains only in the response/client memory until saved or dismissed.

### Cloudflare country forwarding option — 2026-10-24

The Next route adapter accepts optional `trustCloudflareCountry` (default
false). On Vercel, opted-in product proxies prefer normalized `cf-ipcountry`
when it or `cf-ray` is present. Missing/invalid Cloudflare location stays
unknown; direct Vercel traffic uses its existing country header. No IP is
forwarded. The deployment must supply/overwrite these headers at trusted
ingress. Existing collector credential/origin checks, country whitelist,
nullable row field and country-summary contract are unchanged.

Country now appears in Events/Live table columns and event Context details
as flag + English name + code, or Unknown. Saved table layouts keep the
actions column last when new columns are introduced. No migration or
historical backfill is required.

## Breakdown reads — 2026-11-12 (local)

`GET /v1/dashboard/breakdown` returns complete-window aggregates computed in one
SQL statement (`packages/db/src/queries/breakdown.ts`), never derived from the
paged event list. Authentication is the same `/v1/dashboard/*` read middleware:
a project-scoped `read` key for the requested `project` (or the global read key).

Parsing is strict (`parseBreakdownQuery` in `packages/utils/src/breakdown.ts`);
any invalid parameter returns `400 { error }` instead of being ignored.

- Required: `project`, `start`, `end` (ISO 8601 date-times with a zone). The
  window is half-open `[start, end)` and at most 366 days.
- `by`: one or two of `name | source | platform | property:<snake_case_key>`.
- `metrics` ⊆ `events | actors | groups` (default `events`). `actors` counts
  distinct hashed `actorId`; `groups` counts distinct hashed group keys of
  `metricGroupType` (snake_case, default `business`).
- `limit` 1–20 (default 10): top values per dimension by event count over the
  whole window, ties alphabetical. Remaining values fold into `(other)`. Null
  platform, a missing property, or a JSON-null property become `(none)`, which
  is always explicit and never folded into `(other)`.
- `durationProperty=<snake_case_key>`: `percentile_cont` p50/p95 and sample
  count over numeric values only; non-numeric values are ignored.
- `interval=day`: adds a UTC daily `series` containing every day of the window
  (zero totals on empty days). Output is bounded: days × (limit + 2)^dimensions
  ≤ 50,000 or the request is rejected.
- Filters: `organization`, comma-separated `names` (≤50), `sources`,
  `platforms`, `actor` (64-hex hashed reference), `groupType`/`groupKey`,
  `propertyKey`/`propertyValue` (JSON scalar, as event-summary).

Response: `{ project, start, end, by, metrics, metricGroupType, interval, limit,
durationProperty, totals, buckets[], series? }`. Each bucket is
`{ dimensions: { "<dimension>": "<value>" }, events?, actors?, groups?,
duration?: { p50, p95, samples } }`; only requested metrics appear. Totals and
day totals are computed with grouping sets, so distinct counts are exact rather
than sums of buckets. Without a database the endpoint returns 503 (no demo
fallback). The `groups` metric and group filters require the generic-groups
migration `0005`.

`@ishaqyusuf/logly-server` exposes `createAdminClient(...).breakdown(query)`
with matching `LoglyBreakdownQuery`/`LoglyBreakdownResult` types (unpublished).
No dashboard same-origin proxy exists yet; add one when a dashboard view needs it.

### Cloudflare country forwarding option — 2026-10-24

The Next route adapter accepts optional `trustCloudflareCountry` (default
false). On Vercel, opted-in product proxies prefer normalized `cf-ipcountry`
when it or `cf-ray` is present. Missing/invalid Cloudflare location stays
unknown; direct Vercel traffic uses its existing country header. No IP is
forwarded. The deployment must supply/overwrite these headers at trusted
ingress. Existing collector credential/origin checks, country whitelist,
nullable row field and country-summary contract are unchanged.

Country now appears in Events/Live table columns and event Context details
as flag + English name + code, or Unknown. Saved table layouts keep the
actions column last when new columns are introduced. No migration or
historical backfill is required.

### Pages report — 2026-11-24 (local, unreleased)

`GET /v1/dashboard/pages` returns `AnalyticsPagesReport` (`@logly/utils`):
`{ view, range, start, end, previousStart, available: { page_view, screen_view },
totals: { views, visitors, previousViews, previousVisitors, visitorDays },
pages[], entries[], exits[] }`.

- `pages[]` (max 25, by current views): `{ route, views, visitors,
  previousViews, previousVisitors }`. `route` is the stored string or null.
- `entries[]`/`exits[]` (max 10): `{ route, count }`, where count is the number
  of visitor-days (visitor key × UTC day) whose first/last view was that route.
  Events without a visitor key are excluded.
- Windows: `[start, end)` rolling to now; previous window `[previousStart, start)`
  of equal length. Change is derived by the client (Pulse rule; prior 0 = new).
- `view` defaults to `page_view`, or `screen_view` when the window has only
  screen views.

### Tracking-quiet alerts — 2026-11-24 (local, unreleased)

`AnalyticsProjectSummary.trackingAlert?` (overview `projects[]`) is a
`TrackingAlertState`: `{ status, observedEvents, baselineEvents, windowStart,
windowEnd, evaluatedAt, openedAt }`. `status` is `ok`, `drop`, `stopped`,
`low_volume` or `pending`. `openedAt` is set only while an alert is open. The
field is absent in demo mode and in older responses, and clients must tolerate
that.

`GET /v1/dashboard/tracking-alerts` returns `{ state: TrackingAlertState,
history: [{ id, severity: "drop"|"stopped", openedAt, resolvedAt|null,
observedEvents, baselineEvents }] }`. The rule constants live in
`packages/utils/src/tracking-alerts.ts`; see
`../features/tracking-alerts.md`.

### App-version adoption — 2026-11-24 (local, unreleased)

`GET /v1/dashboard/app-versions` returns `AnalyticsAppVersionsReport`
(`packages/utils/src/app-versions.ts`):
`{ range, start, end, granularity: "hour"|"day", lookbackDays: 90, mobile,
totals: { activeUsers, events, unknownUsers, versions }, latestVersion,
series[], versions[], trend[], platforms[] }`.

- Only `source = "mobile"` events count. `mobile` is false when the project
  has none in the 90-day lookback (web-only); clients show an empty state.
- `series[]`: `{ key, label, kind: "version"|"other"|"unknown", version }`.
  Keys are `v0`… (newest first), `other`, `unknown`, because version strings
  contain dots. At most 8 version series, chosen by user-buckets.
- `versions[]` (series order): series fields plus `{ activeUsers|null,
  activeShare|null, currentUsers, currentShare, events, firstSeen|null,
  lastSeen|null, versionCount, builds: [{ build|null, users }],
  platforms: { ios, android, unknown }, latest }`. `activeUsers` is distinct
  users with any event on the version in the range (null for `other`);
  `currentUsers` is users whose latest event in the range was on it (sums to
  `totals.activeUsers`). Builds and platforms count current users. Shares are
  0–1.
- `trend[]`: every UTC bucket in `[start, end)`: `{ bucket, total,
  values: { [seriesKey]: users } }`, each visitor on the version of their
  latest event in the bucket.
- `platforms[]`: `{ platform: "ios"|"android"|"unknown", users, versions:
  [series fields + { users, share }] }`, only platforms with users.
- Version strings are trimmed; blank is null (Unknown). Ordering is semantic
  (`compareAppVersions`). See `../features/app-version-adoption.md` and
  ADR 0016.
