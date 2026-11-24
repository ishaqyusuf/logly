# Tracking-quiet alerts

Implemented locally 2026-11-24 (unreleased; ships with the 8-feature release).
See [ADR 0013](../decisions/0013-tracking-alerts-evaluate-on-read.md).

Detects when a project's event volume drops far below normal or stops.

## Rule (`packages/utils/src/tracking-alerts.ts`)

- Recent window: the last 3 hours, ending 10 minutes ago (delivery lag).
- Baseline: the same 3-hour window on each of the previous 7 days. Baseline =
  min(median of the 7, same weekday last week), so weekly lulls don't alert.
- Minimum volume: no alert opens while the baseline is below 30 events per
  window ("low_volume"), so low-traffic projects don't flap.
- Open: recent < 20% of baseline (`drop`), or 0 events (`stopped`).
- Resolve: recent >= 50% of max(baseline, 30). The gap is hysteresis. An open
  alert stays open while the baseline decays during a long outage.
- Severity moves between `drop` and `stopped` while open.
- Uses `occurred_at` (indexed) rather than `received_at`.

## Delivery

- In-dashboard, and by email since feature 8: opted-in operators get an email
  when an alert opens or resolves ([email digest](email-digest.md),
  [ADR 0020](../decisions/0020-email-channel-weekly-digest.md)).
- Overview shows a red banner while an alert is open, linking to history.
- The header project selector marks the selected project with a red dot, and
  the project list shows "Stopped" or "Dropped".
- Settings has a "Tracking alerts" section (`#tracking-alerts`): current state,
  last check, and the 20 most recent alerts with duration and counts.

## Evaluation (trigger, frequency, timeout, overlap, idempotency)

- Trigger: `GET /v1/dashboard/overview` (every dashboard navigation loads it
  for the shell), `GET /v1/dashboard/tracking-alerts`, and since feature 8 the
  daily email cron (`GET /api/cron/email`, 07:00 UTC), which calls
  `evaluateTrackingAlerts` before emailing transitions.
- Frequency: at most once per project per 5 minutes, and only while someone
  uses the dashboard. Between checks, reads reuse stored state.
- Cost per check: one claim upsert, one query of 8 indexed counts per claimed
  project, then one or two small writes per project.
- Timeout: a read waits at most 1.5s for evaluation (the admin read client
  times out at 4s). On timeout or error the read continues with stored state,
  and the next stale read retries.
- Overlap: the claim is an atomic upsert on
  `analytics_tracking_alert_state.evaluated_at`, so concurrent reads split
  projects and never evaluate one twice.
- Idempotency: a partial unique index allows one open alert per project;
  opening uses `on conflict do nothing`, and resolving only touches an
  unresolved row.

Limitation: `opened_at` is the first check after the drop, not the moment it
began. With the daily cron (ADR 0020) an unwatched project's alert opens, and
is emailed, within 24 hours; dashboard reads open it sooner, and the next cron
run emails it. An hourly schedule (Pro plan) would tighten that.
