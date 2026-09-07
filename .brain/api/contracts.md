# API Contracts

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

## Dashboard Event Reads

Event-list reads accept optional `organization`, `project`, comma-separated
`projects`, `names`, and `sources`, plus `q`, ISO `start`/`end`, `sort`,
`cursor`, and `pageSize`. Supported sort fields are `occurred_at`,
`event_name`, `project`, and `source`, with `asc` or `desc` direction. Page size
is clamped to 10–100 and defaults to 50. Responses use
`{ data: AnalyticsEventRow[], meta: { cursor: string | null } }`.

Filter-option reads return distinct project slugs, discovered event names, and
valid sources for the selected organization/project scope. Dashboard browser
code calls the authenticated same-origin `/api/dashboard/events` proxy; the
server-only read credential never enters the browser bundle.

Event-summary reads require `project` and accept the same `organization`,
`names`, `sources`, `q`, `start`, and `end` filters as the event list. They
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

Event-summary responses add `geography: { totalVisits, unknownVisits, countries: [{ code, name, count }] }`. Codes are ISO 3166-1 alpha-2; names use English display names. Rows sort by count descending then name. Only browser `site_visit` events contribute, across the complete matching project/organization/date/name/source/search scope, independent of pagination. Unknown locations stay in the denominator. No event-body location field is introduced.

After existing client-ingest authentication and origin checks, the collector accepts `x-logly-country` from the credential-authenticated product proxy. The Next adapter reads only Vercel's product-edge `x-vercel-ip-country` when `VERCEL=1`. It ignores browser `x-logly-country` overrides. The collector validates the exact country whitelist and ignores its own geographic edge header; server-write requests never supply country. Country records the delivery network, not residence. No IP/GPS/city is persisted; retries retain the first accepted location.
