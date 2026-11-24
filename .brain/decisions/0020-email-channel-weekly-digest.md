# 0020. Email channel, weekly digest and a daily email cron

Accepted 2026-11-24.

## Context

Logly had no outbound channel: tracking alerts (ADR 0013) were visible only in
the dashboard and were evaluated only on dashboard reads. Feature 8 adds a
weekly per-project email digest, and with it email for alert transitions.
Three of the user's other projects (ewatrade, school-clerk, al-ghurobaa)
already send through Resend. Logly runs on Vercel; the plan's cron limits are
not recorded, and a Hobby project rejects crons that run more than once a day.

## Decision

- **Provider: Resend**, called with `fetch` from a new `@logly/email` package
  (no SDK dependency). One `EmailTransport` interface; the real transport is
  used only when `VERCEL_ENV=production` and `RESEND_API_KEY` and
  `EMAIL_FROM` are set. Local and preview deployments always get a disabled
  transport, so they cannot reach real recipients even with keys present.
- **Recipients** are operators (rows in the auth `user` table) that an admin
  opts in per project or per organization in Settings. Addresses are read at
  send time and never copied into analytics or send tables.
- **Unsubscribe** uses an HMAC token over `(subscription id, kind)` keyed from
  `BETTER_AUTH_SECRET` (no new secret). GET shows a confirmation and changes
  nothing (mail scanners prefetch links); POST, including RFC 8058 one-click,
  unsubscribes without signing in.
- **One daily Vercel cron** (`0 7 * * *` UTC → `GET /api/cron/email`, bearer
  `CRON_SECRET`) does three things in order:
  1. evaluates tracking alerts with the existing claim-based
     `evaluateTrackingAlerts` (so alerts open without anyone reading the
     dashboard),
  2. emails alerts opened or resolved in the last 48 hours,
  3. sends last week's digest for each project, within 48 hours of the week
     ending (Monday's run, with Tuesday as the retry).
  Daily is the most a Hobby plan allows, and it keeps one route and one
  schedule. On a Pro plan the schedule can become hourly (`0 * * * *`) with no
  code change: sends are idempotent and the digest window stays 48 hours.
- **Idempotency**: every email is claimed first in `analytics_email_sends`
  (unique on kind, project, period, recipient; period = digest week's local
  Monday or the alert id). A failed (retryable) send is re-claimed on a later
  run up to 3 attempts; a crashed `sending` claim is re-claimed after 15
  minutes, with the send id as Resend's `Idempotency-Key` so the provider
  drops a duplicate.
- **Digest week**: Monday–Sunday in the project's `timezone` column (default
  UTC). The test send and preview are not recorded and never block the real
  digest.

## Consequences

- New env vars: `RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET` (required for
  sending), `EMAIL_REPLY_TO` (optional). `vercel.json` gains a `crons` entry.
- With the daily schedule, an alert email can arrive up to 24 hours after the
  drop if nobody opens the dashboard; dashboard reads still open alerts
  sooner, and the next cron run emails them. Hourly needs a Pro plan.
- The cron adds one invocation per day (about 30 per month) and at most
  `EMAIL_JOB_MAX_SENDS` (200) provider calls per run, spaced 550 ms for
  Resend's default 2 requests/second. It stops claiming after 45 s of its
  60 s `maxDuration`; leftovers go out on the next run.
- Email delivery is unobservable in local and preview by design; the Settings
  preview and text version show exactly what would be sent.
