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
