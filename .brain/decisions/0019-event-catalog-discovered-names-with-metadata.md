# ADR 0019: The event catalog lists discovered names; metadata is notes only

Date: 2026-11-24. Status: accepted (implemented locally, unreleased).

## Context

Event names are discovered automatically once they pass validation (the
`allowedEvents` config is deprecated), so names drift across releases and
projects (`quote_opened`, `quoteopened`, `quote_open`) and retired events
linger in pickers. Feature 7 asks for one list per project of every name with
its volume, sources, property keys and freshness, plus operator notes, and
hints about likely duplicates, without merging or renaming data.

## Decision

- The catalog's names come from the data: a skip scan over
  `(project_id, name)` lists every distinct name a project has stored, at
  most 500 (alphabetical by database collation; `truncated` flags the rest).
  Names that only have metadata (data aged out) stay listed.
- Stats are computed on read, bounded: first/last seen are min/max per name
  on `(project_id, name, occurred_at)`; range volume, previous-period volume
  and a trend come from one grouped scan of the current and previous windows
  (`24h` hourly, `7d`/`30d` daily, window-relative buckets); sources and
  property keys come from each name's latest 100 events. A 15-second
  statement timeout returns 503. No rollup table or cron.
- Discovery is shared with the funnel builder (`event-vocabulary.ts`): both
  use the same per-name stratified sample, so a low-volume event's keys are
  not crowded out by a busy one (the funnel previously sampled the latest
  5,000 events overall).
- Status: `active` when last seen within N days (7/14/30/90, default 14),
  else `stale`.
- Metadata lives in `analytics_event_catalog` keyed by `(project_id, name)`:
  description, owner/notes, `deprecated`, `hidden`. It never changes event
  data. `deprecated` adds a badge in the catalog, the Events view and the
  pickers; `hidden` removes the name from pickers (funnel builder, retention
  event select, Events name filter) but keeps it in the catalog and in every
  count. Writes are admin, same-origin dashboard route handlers like deploy
  markers and saved funnels; at most 1,000 rows per project.
- Likely duplicates are computed in memory from the listed names and shown as
  hints only: identical letters ignoring `_`/`.`, the same words in another
  order, a short suffix (`s`, `es`, `d`, `ed`, `ing`, `e`) on a name of 4+
  letters, or one edit (including a swap) on 5+ letters. Names that differ
  only in digits (`step_1`/`step_2`) are never flagged.

## Alternatives considered

- A materialized per-name daily table: cheaper reads at high volume, but adds
  a write path or job; unnecessary at current volume and easy to add later.
- Re-introducing an allowlist so hidden names are rejected at ingest: hiding
  is a display concern; rejecting would silently drop data.
- Fuzzy matching with a larger edit distance: flagged real pairs like
  `quote_opened`/`quote_closed`.
- Merging or aliasing names: out of scope by request; products should rename
  at the source and deprecate the old name.

## Consequences

- One catalog read costs one skip scan, two index probes per name, one window
  scan (up to 60 days for `30d`) and a bounded sample; acceptable for the
  current projects, and the first candidate for a rollup if volume grows.
- Event pickers make one extra primary-key read for flags.
- The truncation order follows the database collation, while the in-memory
  spec sorts by code point; they differ only past 500 names.
