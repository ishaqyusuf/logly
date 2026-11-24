# Retention

Implemented locally 2026-11-24 (commit `85cc8d1`, unreleased; ships with the
8-feature release). Feature 5 of the 8 approved.

`/retention` is a selected-project workspace page (sidebar "Retention", after
Versions). It answers: of the users first seen in a day or week, how many come
back later? It reads `GET /v1/dashboard/retention` (see `../api/contracts.md`).
Decision record: [ADR 0017](../decisions/0017-retention-cohorts-first-entry-event.md).

## Definitions

- User: the per-project `visitorKey`. Events without one are ignored.
- Cohort entry: the visitor's first `site_visit` (web SDK) or `app_session`
  (mobile) within the lookback. A visitor with an entry event in the 90 days
  before the first cohort is not new and joins no cohort.
- Returning: any event in a later day or week, or one chosen event name
  ("Returning means" picker, from the project's known event names). Period 0
  is the cohort period and is always 100%.
- Periods are UTC days or ISO weeks (Monday 00:00 UTC).

## What it shows

- Controls (URL-backed): range `7d` (7 daily cohorts, days 0–6), `30d`
  (5 weekly cohorts, the default) or `12w` (12 weekly cohorts, the cap);
  web/mobile segment, shown only when the project sent both `site_visit` and
  `app_session` in the lookback (or when the URL already sets one); the
  returning event.
- KPIs: new users, day/week 1 retention, and the furthest finished period's
  retention.
- Average retention curve: size-weighted average over cohorts that finished
  each period. Unfinished periods are gaps on the axis, not zeros.
- Cohort grid (heat map), newest cohort first: users, then one cell per
  period with % and count. Colour intensity follows the rate.
  - A period still running is hatched with a dashed border and a `*`, and its
    tooltip says it can still grow. It is never shown as a drop and never
    enters the average.
  - Periods that have not started are blank. The current cohort is labelled
    "in progress".
  - Empty cohorts show `—`.
  - An average row heads the grid; the grid scrolls sideways inside its card
    with the cohort column sticky (no page overflow at 375px).
- Deploy markers (feature 2): a diamond on each cohort row whose period
  contains a production release (`groupReleasesByCohort`), with the versions
  in its tooltip. They are not drawn on the curve: its x axis is time since
  entry, so a calendar-time marker has no meaningful position there.
- A note under the grid states the limits below.

## Honesty about the data

- Rates are a lower bound. A visitor ID is per browser or app install and
  resets when storage clears; private windows, second devices and cleared
  storage create new visitors who never "return".
- Mobile clients that reset the visitor on account or context switches
  (ewatrade, halaal-coperative) understate mobile retention further.
- A visitor silent for more than 90 days before the first cohort can count as
  new again.

## Cost

Two reads per page view (plus the existing bounded releases and event-options
reads):

1. Surfaces: two `exists` probes for `site_visit` and `app_session` in the
   lookback, on `(project_id, name, occurred_at)`.
2. Cohorts and activity in one statement: first entry event per visitor over
   the lookback plus window (at most 90 days + 12 weeks of entry events, same
   index), then distinct `(cohort, visitor, period)` for those visitors' events
   from the first cohort to now (`(project_id, occurred_at)`, or the name index
   when a returning event is chosen).

No new index, table or migration (`0010` stays unused). Seeded locally with
~8.8k events the query takes 10–30 ms. The page is request-rendered (`ƒ`),
uncached, like Pages and Versions. If volume grows, a daily per-visitor
activity rollup is the follow-up.

## Not included

- Unbounded (all-time) first seen, and calendar months.
- Cross-project or cross-device identity (deliberately; see ADR 0002).
- Custom cohort entry events.

## Product requirements

Nothing new. Web projects already send `site_visit`; mobile clients send
`app_session`. See row 5 of the
[consumer upgrade guide](../tasks/2026-11-24-consumer-upgrade-guide.md).
