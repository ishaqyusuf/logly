# Event catalog

Status: built locally on `main` (feature 7 of the coordinated 8-feature
release, 2026-11-24); unreleased.
[ADR 0019](../decisions/0019-event-catalog-discovered-names-with-metadata.md).

## Purpose

One list of every event name a project sends, so naming stays tidy and dead
events get noticed. Names are discovered from accepted events; the catalog
adds notes for people and never renames, merges or deletes data.

## Behavior

- Page `/catalog` (sidebar "Catalog", after Events), project-scoped like every
  workspace page. URL state: `range` (`24h`/`7d`/`30d`, default `7d`) and
  `stale` (`7`/`14`/`30`/`90` days, default `14`).
- Metrics: event names, active, stale, names with naming hints, deprecated
  (and how many are hidden).
- Table, one row per name, sorted by range volume, then last seen, then name:
  - name with Deprecated / Hidden / Stale badges, description, owner/notes;
  - volume in the range, a bar sparkline (hourly for 24h, daily otherwise)
    and the change vs the previous equal period ("New" when it was zero);
  - sources (browser / mobile / server) and property keys from the name's
    latest 100 events (first 5 shown, the rest on hover);
  - first seen (date) and last seen (relative; amber when stale);
  - naming hints: "Looks like `quote_opened` (differs by a suffix)".
- Client-side filters (All, Active, Stale, Naming hints, Deprecated, Hidden)
  and search over names, descriptions and notes.
- Admins (database mode) get an edit button per row opening a sheet:
  description (≤280), owner / notes (≤500), Deprecated, Hide from pickers.
  Non-admins see a note instead.

## Pickers

- Deprecated names show a badge in the funnel builder (datalist label and a
  badge under the step), the retention event select ("(deprecated)"), the
  Events name filter, the Events table event cell, and the Events "Count by
  event name"/"Momentum" lists.
- Hidden names drop out of the funnel builder's event list, the retention
  event select and the Events name filter. A saved funnel that uses a hidden
  name still runs; its step says "Hidden in the event catalog". A currently
  selected hidden retention event stays selectable.

## Likely duplicates (hints only)

Two names are flagged when, comparing without `_` and `.`: they are equal
(`quote_opened`/`quoteopened`); they have the same words in another order
(`opened_quote`); one is the other plus `s`, `es`, `d`, `ed`, `ing` or `e`
on 4+ letters (`quote_open`/`quote_opened`); or they are one edit apart on 5+
letters (`qoute_opened`). Names differing only in digits are not flagged.

## Data And API

- Table `analytics_event_catalog` (migration `0012_event_catalog`). See the
  [schema](../database/schema.md) and [migrations](../database/migrations.md).
- `GET /v1/dashboard/event-catalog` (new); `GET /v1/dashboard/event-options`
  adds `deprecated` and leaves out hidden names; `GET /v1/dashboard/funnels`
  marks `events[].deprecated`, leaves out hidden names and adds `hidden`.
  Dashboard `PUT /api/event-catalog` (admin, same-origin). See
  [endpoints](../api/endpoints.md) and [contracts](../api/contracts.md).
- Contract, spec and duplicate rules: `packages/utils/src/event-catalog.ts`.
  Queries: `packages/db/src/queries/event-catalog.ts`, shared discovery
  `event-vocabulary.ts` (also used by `getFunnelOptions`). UI:
  `apps/dashboard/src/components/event-catalog/*`,
  `app/(sidebar)/catalog/page.tsx`, route `app/api/event-catalog/route.ts`.

## Cost bounds

500 names (skip scan), two index probes per name for first/last seen, one
grouped scan of the current + previous window (≤60 days) on
`(project_id, occurred_at)`, 100 latest events per name for sources and keys,
≤1,000 metadata rows, 15-second statement timeout (503 "Try a shorter range").
Page reads are request-time (`force-dynamic`): one catalog read per view; no
polling, cron or cache. Pickers add one primary-key read of flags.

## Acceptance Checks

- Unit tests (`apps/dashboard/src/lib/event-catalog.test.ts`): duplicate
  rules and non-matches, volume/previous/trend buckets including the window
  end, sources and key cleanup, stale threshold, metadata-only names, the
  500-name cap, picker filtering and input parsing.
- Route tests (`event-catalog-route.test.ts`): admin + same-origin, 400 on
  invalid input, 413 on a large body, 404 and 409.
- SQL fixture (`packages/db/src/queries/event-catalog.sql.test.ts`,
  `logly_test`): the query equals the in-memory spec for four range/stale
  pairs on ~1,900 generated events (including the window end); project and
  organization isolation; upserts, metadata joins, picker flags, the funnel
  picker dropping a hidden name, and the per-project limit.
- Local seed (`packages/db/scripts/seed-event-catalog-qa.ts`): a gnd-shaped
  project with `quote_opened`, drifted `quoteopened` and `quote_open`, and a
  retired `dealer_program_progress_viewed`: 10 names, 2 stale, 3 with hints,
  hidden `quote_open` absent from the funnel picker.
- Browser QA (2026-11-24) on the local stack with an admin session: the real
  `/catalog` page (7d/14d and 30d/30d), the edit sheet saving through
  `PUT /api/event-catalog` (200), the funnel builder badge and "Hidden in the
  event catalog" note, `event-options` without the hidden name, and 375px
  width (table scrolls inside its card, no page overflow).
