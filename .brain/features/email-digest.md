# Weekly email digest and alert emails

Implemented locally 2026-11-24 (unreleased; ships with the 8-feature release).
See [ADR 0020](../decisions/0020-email-channel-weekly-digest.md).

Logly's first outbound channel. Each opted-in operator gets a short weekly
digest per project, and an email when a tracking alert opens or resolves.

## Digest content

For the last complete Monday–Sunday in the project's time zone
(`analytics_projects.timezone`, default UTC), from
`getWeeklyDigestMetrics` (`packages/db/src/queries/email.ts`):

- Visitors (distinct `visitor_key`) and events, with change from the week
  before.
- Top 5 pages, or screens for mobile-only projects: the Pages report query
  (`getDashboardPages`) with an explicit window.
- Biggest movers: event names with the largest absolute weekly change, at
  least 10 events in one of the two weeks, excluding automatic events
  (`page_view`, `screen_view`, `site_visit`, `app_session`). Up to 5.
- Releases recorded that week (`listReleases`), oldest first, up to 10.
- Tracking alerts opened or resolved that week.
- A link to the project's Overview.

Rendering (`packages/email/src/render.ts`): table-based HTML with inline
styles, no images, scripts or web fonts, max width 560px, plus a plain-text
version with the same facts. Subject: `<Project> weekly digest · Nov 16 –
Nov 22, 2026`. Every email carries `List-Unsubscribe` and
`List-Unsubscribe-Post` headers and a footer unsubscribe link.

## Alert emails

When a tracking alert (feature 3) opens, opted-in operators get
"Tracking stopped/dropped: <Project>" with the observed and usual 3-hour
counts; when it resolves, "Tracking recovered: <Project>". An alert that
opened and resolved between two runs gets only the recovered email.

## Recipients (Settings → Email, admin only)

- Rows: every non-banned operator. Columns: weekly digest and tracking alerts,
  for this project and for every project in its organization.
- An operator subscribed both ways gets one email; the organization row is
  used for the unsubscribe link, and unsubscribing from it turns that kind off
  for the whole organization (its row and the operator's project rows in it).
- "Preview digest" opens the rendered HTML of last week's digest;
  "Text version" shows the fallback; "Send test digest to me" sends it to the
  signed-in admin (production only; marked `[Test]`, not recorded).
- When sending is disabled (local, preview, or missing keys) the section says
  why; opt-ins are still saved.

## Schedule (trigger, frequency, timeout, overlap, idempotency)

- Trigger: Vercel cron `0 7 * * *` (07:00 UTC daily) → `GET /api/cron/email`
  with `Authorization: Bearer $CRON_SECRET`. Without `CRON_SECRET` the route
  returns 503 and runs nothing. Owner: the dashboard deployment.
- Each run: evaluate tracking alerts (claim-based, at most once per project
  per 5 minutes, shared with read-time evaluation), email alert transitions
  from the last 48 hours, then send last week's digests while within 48 hours
  of the week's end (Monday, with Tuesday as retry; Lagos/UTC projects get it
  Monday 07:00 UTC).
- Timeout: `maxDuration` 60 s; the job stops claiming new sends after 45 s or
  200 sends, and each provider call times out after 10 s. Leftovers go out on
  the next run.
- Overlap and idempotency: `analytics_email_sends` has one row per kind,
  project, period (week's local Monday or alert id) and recipient. Claiming is
  an atomic `insert … on conflict do update … where` that only succeeds for a
  new row, a retryable failure under 3 attempts, or a `sending` claim older
  than 15 minutes. Concurrent runs serialize on the unique index, so one
  recipient never gets the same digest twice. The send id is Resend's
  `Idempotency-Key`. 4xx provider errors are recorded as `rejected` and not
  retried.
- Cost: about 30 invocations a month; queries are bounded to one project and
  two weeks on existing indexes; the digest is queried once per project only
  after a claim succeeds.

## Safety

- Sends only when `VERCEL_ENV=production` and `RESEND_API_KEY` and
  `EMAIL_FROM` are set; local and preview always use a disabled transport.
- Addresses come from the auth `user` table at send time; send rows hold the
  user id, never the address. No analytics events are emitted.
- Unsubscribe tokens are HMAC-SHA256 over `u1.<subscription id>.<kind>` with a
  key derived from `BETTER_AUTH_SECRET`; rotating that secret revokes links.

## Follow-ups

- Hourly cron on a Pro plan for faster alert emails.
- Per-organization time zone if organizations get one (projects already have
  `timezone`; the digest uses it).
- Delivery webhooks (bounces) from Resend, if bounces become a problem.
