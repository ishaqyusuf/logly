# Generic group and user analytics

Implemented locally on 2026-10-01; deployment and consumer configuration pending review.

Events accept optional `actorId` and generic `groups`, for example
`{ business: { key: "opaque-reference", properties: { name: "Amina Market" } } }`.
Logly has no business/client columns. Group types are product-defined. A stable
key identifies the entity; its name is a display property. Renames do not change
identity and duplicate names remain separate. Group properties are immutable
event snapshots, not a mutable company/profile directory. The picker uses the
latest received label per project/type/key.

Core/browser and native clients expose `identify`, `group`, `clearGroup`,
`setGlobalProperties`, `unsetGlobalProperties`, and `reset`. Properties and groups
are copied at capture time. Changing actor clears old groups/defaults; reset
clears pending events and context and rotates visitor identity. No anonymous
history is merged. Server capture accepts per-call context to avoid shared user
state. Oversized events are rejected before queuing; UTF-8 batch limits apply.

The Events workspace supports searchable groups, an actor filter from event
detail, and one typed event-property equality filter (text/number/boolean/null).
Filters persist in the URL and apply to SQL event rows and complete-window
summary counts, trend, momentum, geography, acquisition and mobile breakdowns.
Null does not match a missing property. Loading/error states do not display the
initial unfiltered totals. Other dashboard workspaces remain project-wide.

Product adapters derive user and active business from authorized server context,
issue a signed capture-time snapshot, and verify it at their ingest proxy. They
discard submitted actor/group overrides and omit the proof before forwarding.
Both products preserve approved scalar event metadata. Business display names
are permitted group labels; user email, names, form data and raw database IDs
are not collected. SDK package versions have not been published in this change;
consumer adapters are compatible with the existing published dependency.

EwaTrade uses `LOGLY_IDENTITY_SECRET`; Halaalvest uses
`LOGLY_ATTRIBUTION_SECRET` (each private, at least 32 characters). Configure a
consistent value across each product's issuer/proxy deployments. Existing enable,
privacy and platform gates continue to apply. No secrets or rollout flags were
activated by this implementation.

Tenant-facing analytics is a future feature: a product backend must authorize
the current membership and enforce group scope on every read. A browser filter
is not authorization and Logly's project read key must never reach a merchant.
Mutable person profiles, group-property query operators, multi-property filter
builders, funnels by group, saved views, and historical backfills are not part
of this implementation.
