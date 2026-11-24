# ADR 0017: Retention cohorts start at a visitor's first entry event

Date: 2026-11-24. Status: accepted (implemented locally, unreleased).

## Context

Feature 5 reports how many users come back after their first visit. Logly has
no user accounts across projects: the only stable user is the per-project
`visitorKey`, which is per browser or app install and resets when storage is
cleared. Cohort entry needs a definition that works for web and mobile, stays
bounded in cost, and does not show the current week as a drop.

## Decision

- A user is the per-project `visitor_key`. Events without one are ignored.
- Cohort entry is a visitor's first `site_visit` (web) or `app_session`
  (mobile). First means the earliest entry event in a 90-day lookback before
  the first cohort plus the cohort window; a visitor with an entry event
  before the first cohort is not new and joins no cohort.
- Returning is any event in a later period (day or week since the cohort
  period), or one chosen event name. Period 0 is the cohort itself (100%).
- Cohorts are UTC days (7) or ISO weeks starting Monday (5, or 12 at most).
- Periods that have not ended are flagged `partial`; periods not started are
  null. The average curve and the average row use only finished periods,
  weighted by cohort size.
- The web/mobile filter scopes both entry and returning events by `source`
  (web is every non-mobile source).
- Reads use existing indexes; no table, rollup, index or migration.
- Deploy markers mark the cohort a release landed in, not the curve, because
  the curve's x axis is time since entry rather than calendar time.

## Alternatives considered

- `visitKind = "new"` on `site_visit` as the entry signal: needs no lookback,
  but mobile `app_session` has no visit kind and older SDKs did not always
  send it. Kept as a possible cross-check.
- All-time first seen: exact but scans a project's whole history on every page
  view. The 90-day lookback bounds the scan; visitors who return after more
  than 90 days of silence can count as new.
- A daily retention rollup: unnecessary at current volume (local reads take
  10–30 ms); revisit with the general rollup work.

## Consequences

- Every rate is a lower bound: a user on a second device, in a private window,
  or after clearing storage is a new visitor who never returns. The page and
  feature doc say so.
- Projects whose mobile client resets the visitor on account or context
  changes (ewatrade, halaal-coperative) understate mobile retention further.
- Partial periods can rise until they end; they are never averaged.
