# Project event registry and manifest synchronization

Status: proposed, 2026-09-08. User requested insight and an implementation plan;
implementation and release have not started.

## Problem and outcome

Logly discovers names from received events. A declared event that has never
occurred cannot be selected through normal filters or funnel selectors. Funnel
choices additionally come from the current summary window in the Insights page.
Provide a project-scoped registry of declared and observed names, independent
of event occurrences and report dates. Registering a definition must never
create activity, visitors, conversion, or collection-health receipts.

## Existing seams

- `packages/analytics-core/src/catalog.ts` exports a passthrough
  `defineEventCatalog` helper; it does not publish definitions.
- `packages/db/src/schema.ts` has `analytics_projects.event_catalog`, a string
  array. Project creation currently initializes it to an empty array. It is not
  a synchronized registry.
- `GET /v1/dashboard/event-options` discovers names from stored rows.
- `apps/dashboard/src/app/(sidebar)/insights/page.tsx` feeds summary event names
  into `components/funnel-report.tsx`.
- `packages/db/src/queries/funnel.ts` counts real ordered browser visitor-days;
  preserve its project scope, strict timestamp ordering and same-UTC-day rules.

## Product contract

An event definition describes something the application can emit. An event
occurrence records something that happened. The registry contains the union
of explicit declarations and automatically observed events. Registration is
optional; uncatalogued valid ingestion continues to work.

Show independent facts: declared in a manifest, observed since registry
tracking began (including retained-data backfill), last seen, and deprecated.
Use “Not observed yet” rather than claiming an event has never occurred:
historical data may already have expired. Counts remain specific to the
selected report window. A zero count does not prove broken instrumentation.

## Phase 1: shared manifest and persistence

Define a bounded, versioned JSON manifest with event name, event version,
description, and allowed source(s). Reuse event-name validation. Keep property
schemas and arbitrary metadata out of the initial release. Never export sample
payloads, user identities, secrets, or property values from the existing helper.
Preserve compatibility for existing `defineEventCatalog` consumers; prefer an
additive serializer and optional metadata extension after inspecting consumers.

Add `analytics_event_definitions`, unique by project/name/version, with declared
and observed sources, declaration timestamp, first/last receipt timestamps,
description and deprecation metadata. Use separate declaration and observation
fields so ingestion cannot overwrite authored descriptions or deprecation.
Name-based selectors deduplicate versions because current reports aggregate by
name. Version-specific analytics are outside this change.

Backfill names/versions/sources and observation bounds from retained events;
import any existing project catalog names as version-1 declarations. Retain the
old column during transition, then remove it in a separate migration once all
readers and writers are verified. Registry observations survive raw retention;
the registry stores no visitor identities or occurrence payloads.

## Phase 2: synchronization and ingestion

Add a project-scoped authenticated manifest upsert endpoint and a paginated,
searchable registry read endpoint. Use operator authorization for dashboard
management and project administration credentials for CI writes. Verify the
existing admin-key enforcement path before reuse; define narrower catalog-write
scope later if provisioning needs it. Read and ingest keys cannot write manifests.
Validate the entire manifest before an atomic write; cap body size, definition
count, and metadata lengths. Invalid submissions leave existing definitions intact.

Provide a build-time JSON exporter and a trusted CLI/server sync command. CI
publishes the manifest for the selected project/environment as a release step;
surface success/failure and manifest hash in its output. Keep credentials out of
browser and mobile bundles. Local export works without credentials.

Start with additive, idempotent upserts. Repeated hashes do not change state;
omission never deletes or deprecates a name. Multiple deployment surfaces can
therefore publish subsets safely. Reject conflicting metadata for an existing
definition unless an explicit revision/update is supplied. Deprecation is an
explicit operator action. A rollback cannot silently remove newer definitions.
Automatic snapshot replacement and authoritative multi-producer reconciliation
are deferred.

During ingestion, upsert observed metadata only for accepted, newly persisted
events, using distinct batch names and the existing idempotency boundary.
Keep registry observation and event persistence transactionally consistent.
Retries must not fabricate activity or advance receipt health. Do not make the
manifest an ingestion allowlist.

## Phase 3: dashboard and export

Switch event-name options and funnel choices to the project registry, independent
of report dates. Preserve legacy name-array consumers or version the response
additively. Use one shared registry client with project-keyed caches and invalidate
after sync. Verify the nearest Midday table/filter analogue before UI work.

Declared unobserved names are selectable. Filters show zero real rows and clear
empty messaging. Funnels calculate from real events only; zero entrants should
show “No entrants” and an undefined conversion display rather than imply measured
conversion. A later unobserved step yields zero completions. Server-only names
remain filterable but are disabled with an explanation in current browser-only
funnels; unknown source eligibility should be explained without falsely asserting
eligibility.

Add a Definitions view within Events, with name, description, sources,
declaration/observation facts, last receipt, and deprecation. Export all matching
definitions as versioned JSON and CSV through authorized project-scoped reads,
not just the loaded table page. Keep an importable declaration-only JSON manifest
distinct from the inventory export containing observation metadata. JSON is the
canonical machine format; escape CSV formula-leading values.

## Phase 4: consumer adoption and optional discovery

Prove the flow in Logly and one consumer: define events once in the product's
shared analytics module, reference the same names in tracking code, export at
build time, and sync from CI. Include enabled SDK system events in the manifest
without asserting that optional pageviews are enabled everywhere.

An optional later AST scanner can find literal tracking calls and
`data-logly-event` attributes and compare them with the manifest. It must report
unresolved expressions and wrappers, not claim complete discovery. Computed event
names, runtime configuration and unreachable code cannot reliably establish the
full deployed event set through static scanning alone. Explicit manifests are
the dependable source for untriggered names.

## Acceptance and rollout

1. Sync three declarations with no traffic: all appear in the registry and event
   filters; browser-compatible names appear in funnels; all activity remains zero.
2. Emit one declared event: observation metadata updates and exactly one real
   occurrence is counted. Replaying its ID changes neither count nor last receipt.
3. Emit an undeclared valid event: it becomes discoverable without registration.
4. Change the report window or expire retained rows: registry names remain,
   while window counts and observation labels remain truthful.
5. Test project isolation, revoked/expired/wrong-scope credentials, invalid and
   oversized manifests, conflicting updates, repeated syncs, concurrent ingest,
   version deduplication and omitted/deprecated definitions.
6. Verify zero-entrant and zero-completion funnel states, server-only exclusion,
   complete export pagination and project-switch cache isolation.
7. Run focused DB/API tests, `bun run typecheck`, `bun run lint`, `bun run test`,
   `bun run build:dashboard`, and desktop/mobile browser QA for changed UI.
8. Roll out additive schema/backend first, then dashboard and consumer CI sync.
   Verify migration/backfill on a local fixture before production rollout.

Before implementation, record an ADR preserving optional discovery while adding
manifest registration. Update database schema, API endpoints/contracts/permissions,
first-party analytics feature docs and task status as their behavior is implemented.
No current runtime contract or accepted architecture decision changed in this
planning-only pass.
