# First-Party Analytics

## Behavior

- Create a project-scoped local visitor ID only after tracking permission is allowed.
- Suppress optional analytics when permission is denied or GPC/DNT is active.
- Record at most one `site_visit` event per browser day.
- Classify the first visit as new and later visit days as returning.
- Send only the first-ever `site_visit` immediately.
- Persist later visits and events in a bounded IndexedDB queue and flush after
  60 seconds, at 25 events, at 48 KiB, on lifecycle changes, or when
  connectivity returns.
- Retain failed events with stable IDs and acknowledge them only after a
  successful collector response.
- Support opt-in pathname-only `page_view` events for initial loads and Next.js
  route changes.
- Support opt-in declarative clicks through `data-logly-event` and
  `data-logly-prop-*` without reading text, form values, URLs, IDs, classes, or
  unrelated attributes.
- Route browser batches through the product's same-origin endpoint.
- Accept structurally valid, versioned, bounded events automatically for an
  authenticated project. Event names are discovered from ingestion; project
  setup never requires a manually synchronized catalog.
- Permit safe operational events but never accept unrestricted log bodies,
  stack traces, secrets, form values, email addresses, or raw authenticated IDs.

## Dashboard

- Use Signal Studio as the implemented project-workspace direction: a dedicated Overview
  for visitors, new/returning mix, total events, trend, top events, recent
  signals, and collection health; Events remains a separate investigation page.
- Compute summaries over the complete requested project and time window; never
  derive totals from a paginated or truncated event list.
- Provide URL-driven search, mandatory project scope, source, event-name,
  date, and sort filters with removable chips and keyboard search/clear actions.
- Page event reads at the database boundary and load additional pages through
  an authenticated same-origin route. TanStack Query owns server state;
  TanStack Table owns presentation state.
- Preserve the applicable Midday table core: stable rows, virtualization,
  infinite loading, sticky columns, column resize/reorder/visibility, horizontal
  navigation, selection, safe JSON copy/export, and persisted table settings.
- Open event detail in a URL-addressable sheet.
- Keep demo data visibly labeled and separate from production persistence.
- Show project-level last-event and collection-health state inside the selected
  workspace. Cross-project portfolio analytics are not part of the dashboard.
- Put the complete filtered event count, count by event name, trend, and
  previous-window momentum above the paginated event table. These summaries
  use complete-window queries and change with the same project and filter state.
- Provide connected Live, Insights, and project Settings views. Live polls the
  last 15 minutes for instrumentation checks; Insights summarizes 30-day event,
  route, and source patterns; Settings shows only the selected project's
  identity, collector state, and privacy boundaries.

## Production Readiness

- Operator authentication protects persisted dashboard pages and reads.
- Browser ingestion enforces each project's allowed-origin policy.
- Project creation accepts 1–10 comma- or newline-separated HTTPS origins,
  normalizes them to origins, rejects mixed invalid input, and de-duplicates the
  stored allowlist. Localhost HTTP remains available for development only.
- Trusted server ingestion verifies the signed request body.
- Production collector, database, hash-secret, and read configuration fail
  closed; demo mode is unavailable as an implicit production fallback.
- Full-scope SQL aggregates are implemented; idempotent daily rollups remain.
- TODO: run retention cleanup and verify restorable database backups.
- TODO: replace placeholder delivery-rate values with observed ingestion health.

## Package Distribution

- Publish `@ishaqyusuf/logly-core`, `@ishaqyusuf/logly-next`, and
  `@ishaqyusuf/logly-server` as versioned ESM packages. A future branded npm
  organization will require new package names and a deliberate consumer
  migration; npm user-scoped packages cannot be transferred between scopes.
- Packed packages contain built `dist` output and rewrite internal
  `workspace:*` dependencies to the published version.
- Every public SDK prepack removes only its own previous `dist` output before
  rebuilding. Published tarballs exclude tests and stamp batch metadata with
  the real `@ishaqyusuf/logly-core` package identity.
- Product repositories install the packages from a stable registry; they do
  not copy SDK source or depend on a sibling filesystem path in production.
- Version `0.2.0` of all three packages is published on npm under the
  `@ishaqyusuf` user scope and is production-proven by Afterservice.
- Keep the external tracking interface limited to initialization, explicit
  tracking, opt-in pageviews, flushing/reset, and trusted server tracking. Runtime-specific
  behavior belongs in adapters such as `analytics-next`; add another adapter
  only when a real runtime requires different behavior.

## API Keys

- `client-ingest` authenticates a product's same-origin browser proxy.
- `server-write` authenticates trusted product server events.
- `read` authenticates project reporting reads.
- `admin` is reserved for project and key administration.
- Project keys are hashed at rest, revocable, expirable, and never exposed to
  browser bundles.

## Acquisition reporting expansion (in progress)

The event-summary read contract includes complete-window browser visitor-day
arrival counts by referrer host and campaign source, using existing captured
fields. Database and demo summaries are implemented locally; Insights UI,
real-database verification, responsive screenshots, and deployment remain
pending under LGL-101. See ADR 0006 for the authorized expansion scope.

### Local reporting UI and health implementation

Insights now renders acquisition cards with full-window totals and shares,
explicit unattributed/direct labels, and empty messaging. Populated and empty
local browser states were inspected; desktop and 390px screenshots are stored
under `.brain/tasks/analytics-expansion/screenshots/`.

Overview now replaces the placeholder delivery percentage with observed
receipt count, last receipt and mean nonnegative arrival lag; the header no
longer claims collector uptime. Batching, offline time and clock differences
are explained. Unknown and demo states do not show fabricated metrics.
Database-backed checks pass for acquisition and populated/empty health.
These changes are local and await the combined production release.

### Same-day conversion funnels

Insights includes two required and three optional event selectors backed by
discovered event names. A GET form persists the chosen steps and project in
the URL and renders ordered visitor-day counts, entrant conversion percentage,
and drop-off counts. Only browser events with a visitor key qualify; steps
must be strictly later on the same UTC day. No cross-day identity is added.
Local SQL fixture verifies 251 → 200 → 100 and rejects reverse ordering and
wrong-organization matches. Four unit tests cover ordering, ties, repeated
steps, source/identity/day/project exclusion and invalid ranges. Desktop and
390px mobile screenshots are in the expansion task directory.

The acquisition, funnel and observed-health reports are deployed in release
`4f8cea9`, Vercel deployment `dpl_ELKo4hVahZmsWW6AXjVpeRzDDjL4`. Production
Chrome verified real Afterservice acquisition, a successful funnel read and
truthful no-recent-arrival health. Earlier local-only notes above are superseded
by this release evidence.

### World country heat map

Insights shows country-shaded daily visit arrivals for the selected project's last 30 days. Country selection exposes count and percentage; the ranked HTML list shows each country's flag, explicit singular/plural visit count and percentage, with touch/keyboard support for territories too small for the map. A visible fewer-to-more legend explains the tested count-relative heat scale. Missing/invalid/historical metadata remains explicitly unknown. Self-hosted public-domain Natural Earth geometry avoids runtime map service requests. No IP or precise location is stored. ADR 0007 authorizes this feature. Validation/screenshots/release evidence: `../tasks/country-map/report.md`. The Next adapter patch 0.2.1 was explicitly approved and accepted by npm on 2026-09-07. Registry metadata and the downloaded artifact are verified. Requested consumer proxies are deployed with country forwarding; live Halaalvest production acceptance is recorded in `../tasks/country-map/production-qa-2026-09-12.md`.
