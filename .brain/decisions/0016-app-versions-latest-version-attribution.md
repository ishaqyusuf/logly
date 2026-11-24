# ADR 0016: App-version adoption attributes users to their latest version

Date: 2026-11-24. Status: accepted (implemented locally, unreleased).

## Context

Feature 4 reports how fast mobile releases spread. A user who upgrades inside
the range has events on two versions. Counting them under both inflates the
chart (stacks above 100%) and hides whether an old build still has users.
Counting distinct users per version over a whole range also cannot be summed
into an "Other" bucket.

## Decision

- The chart and the "still on it", build and platform figures attribute each
  visitor to the version of their latest mobile event in the bucket or range.
  These partition users, so shares sum to 100% and Other/Unknown are exact.
- The table also shows "active users": distinct users with any event on the
  version in the range, the conventional per-version metric. It is omitted for
  Other.
- The top 8 versions are chosen by user-buckets (users summed across chart
  buckets) so versions that dominated earlier in the range keep a series.
- Versions sort semantically, not as strings.
- Reads use existing columns and indexes; no table, index or migration.
  First seen looks back 90 days, which also decides whether a project counts
  as mobile.

## Consequences

- An old build reading "still on it: 0" can be dropped for users active in the
  range; users inactive in the range are not visible.
- No rollup means each page view scans up to 90 days of the project's mobile
  events. Acceptable at current volume; a daily per-version rollup is the
  follow-up if it grows.
- The version is whatever the client sends (native binary version for clients
  using `expo-application`); OTA update adoption is out of scope.
