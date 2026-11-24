# 0013. Evaluate tracking-quiet alerts on dashboard reads

Accepted 2026-11-24.

Tracking-quiet alerts need periodic evaluation. Logly has no email channel,
so for now alerts are seen only in the dashboard. An hourly Vercel cron would
add a scheduled invocation every hour, whether or not anyone looks. It would
also fail deployment on a Hobby-plan project, which only allows daily crons.

Decision: evaluate alerts lazily on authenticated dashboard reads (overview
and alert endpoints), throttled to once per project per 5 minutes. An atomic
upsert claim prevents overlap, a partial unique index keeps one open alert
per project, and a 1.5s bound means evaluation never fails a read.

Consequences:

- No new route, cron, env var or Vercel configuration.
- An alert's `opened_at` is the first evaluation after the drop, not its start.
- Adding email (or any push channel) requires a scheduled trigger. Reuse
  `evaluateTrackingAlerts` from a cron route handler authenticated with
  `CRON_SECRET`, check the Vercel plan's cron frequency, and record the job's
  timeout and ownership. The claim and unique index already make that safe to
  run alongside read-time evaluation.
