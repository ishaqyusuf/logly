# ADR 0018: Funnels are ordered per visitor within a conversion window

Date: 2026-11-24. Status: accepted (implemented locally, unreleased).
Supersedes the same-day funnel scope in
[ADR 0006](0006-portfolio-analytics-expansion.md).

## Context

The first funnel (ADR 0006) counted visitor-days: steps had to happen on the
same UTC day, browser events only, 2–5 names. Feature 6 asks for a builder
with 2–8 steps, per-step filters, a conversion window up to 30 days, saved
funnels and a breakdown, at bounded cost. ADR 0006 also said "no cross-day
identity". The browser SDK already keeps one `visitorId` per project in local
storage across days, and mobile clients keep one per install, so a cross-day
window adds no new identity: it reads the same project-scoped `visitor_key`
that Overview and retention already count.

## Decision

- Identity: the per-project `visitor_key`, from any source that carries one.
- Entry: the earliest step-1 event in the date range. Repeated step-1 events
  do not start new attempts.
- Each later step: the earliest matching event strictly after the previous
  step and no later than entry + window (1h, 1d, 7d or 30d), inside the range.
- Each visitor counts at most once per step; one event never satisfies two
  steps.
- Filters: an exact route template and one property equals-filter (as text)
  per step. Breakdown dimensions come from the step-1 event: platform,
  country, app version or source, top 5 plus `(other)`.
- Bounds: 2–8 steps, 90-day range, the earliest 50,000 entrants (flagged
  `capped`), a 15-second statement timeout, scans limited to the steps' event
  names. Computed on read with staged CTEs; no rollup.
- Saved funnels (name, steps, window) are a per-project table; writes are
  admin, same-origin dashboard route handlers like deploy markers. Reads go
  through the collector read API.

## Alternatives considered

- Keep visitor-days: simple but cannot measure multi-day flows (quotes,
  onboarding), and windows shorter than a day were impossible.
- Best attempt per visitor (any step-1 occurrence that gets furthest):
  slightly higher conversion for retried flows, but needs per-attempt
  expansion that grows with event volume. The earliest-entry rule is
  documented instead.
- Free-text property keys: would let a typo silently return zero; keys are
  limited to those Logly has stored for the event.
- A materialized per-visitor step table: unnecessary at current volume.

## Consequences

- Conversion is a lower bound for flows that span devices or storage resets,
  like retention.
- A visitor whose first attempt fails and a later one succeeds counts as not
  converted.
- Server events join a browser funnel only when the product forwards the
  browser `visitorId`; otherwise they are excluded (null key) or form their
  own visitors.
- Beyond 50,000 entrants only the earliest are followed; the page tells the
  operator to narrow the range.
