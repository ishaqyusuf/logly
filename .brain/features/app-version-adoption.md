# Mobile app-version adoption

Implemented locally 2026-11-24 (commit `b58bfe5`, unreleased; ships with the
8-feature release). Feature 4 of the 8 approved.

`/versions` is a selected-project workspace page beside Pages. It answers two
questions for a mobile app: has the new release reached users yet, and can an
old build be dropped. It reads `GET /v1/dashboard/app-versions` (see
`../api/contracts.md`). Decision record: [ADR 0016](../decisions/0016-app-versions-latest-version-attribution.md).

## What it shows

- KPIs: active app users (distinct visitor keys with a mobile event in the
  range), the newest version and the share of users now on it, versions in use,
  and the share of users with no `appVersion`.
- Adoption over time: stacked area per UTC hour (24h) or UTC day (7d, 30d).
  Each visitor counts once per bucket, on the version of their latest event in
  that bucket, so the stack sums to the bucket's users. "Share" normalises each
  bucket to 100%; "Users" shows absolute counts. Tooltip lists users and share.
- Version table, newest first in semantic order (`1.9.0 < 1.10.0`,
  `1.0.0-beta < 1.0.0`, `1.2 = 1.2.0`, `v` prefix and `+build` ignored):
  - Active users and share: distinct users with any event on the version in
    the range. A user who upgraded counts under both versions.
  - Still on it: users whose latest event in the range was on the version.
    This column partitions the active users (sums to 100%) and is the signal
    for dropping a build: 0 means everyone who used it has moved on.
  - iOS · Android split and builds (both of the still-on-it users), first seen
    (within a 90-day lookback) and last seen (in the range), in UTC.
- By platform: each platform's version mix (still-on-it users).
- Deploy markers (feature 2): production releases from
  `GET /v1/dashboard/releases` are drawn on the adoption chart with the shared
  `components/charts/release-markers.tsx` layer, and listed in the tooltip.
  Report buckets are full ISO strings, so the chart maps them to Pulse's
  release bucket keys (`releaseBucketKey`). Record mobile store releases
  (EAS submit) as releases to see when each wave started.

## Edge cases

- No `appVersion` (null or blank): one "Unknown" bucket, always last.
- Many versions: the top 8 by user-buckets (users summed across chart buckets)
  get their own series; the rest fold into "Other (n versions)". Ranking by
  user-buckets keeps a version that dominated earlier in the range visible
  after users upgraded. Other's active-user count is shown as "—" because
  per-version distinct counts cannot be de-duplicated; its still-on-it count
  is exact.
- Web-only projects: no mobile events in the 90-day lookback gives
  `mobile: false` and an explanatory empty state instead of the report.
- Events without a visitor key count toward events, not users.
- Platforms other than `ios`/`android` show as "Unknown platform".

## Cost

Three bounded SQL reads per page view (plus the bounded releases read), each limited to one project and
`source = 'mobile'`: latest event per visitor (range), per-version activity
(90-day lookback), and latest event per visitor per bucket (range). They use the
existing `(project_id, occurred_at)` index; no new index, table or migration. No
caching; the page is request-rendered like Pages. The 90-day lookback scan is
the largest read; if mobile volume grows, a daily per-version rollup is the
follow-up.

## Not included

- OTA (EAS Update) adoption: the version is the native binary version
  (or the Expo manifest version), not the OTA update. Tracking updates needs
  `runtimeVersion`/`updateId` in the event contract and SDKs.

## Product requirements

Mobile events must carry `appVersion` and `appBuild` (and `platform`,
`source: "mobile"`, a stable per-install visitor). Per-project status as of
2026-11-24 is in the
[consumer upgrade guide](../tasks/2026-11-24-consumer-upgrade-guide.md), row 4.
