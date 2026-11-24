import {
  type AnalyticsAppVersionsReport,
  type AnalyticsOverviewRange,
  appVersionsGranularity,
  appVersionsWindow,
  buildAppVersionsReport,
  getDemoAnalytics,
  summarizeAppVersions,
} from "@logly/utils";
import { sql } from "drizzle-orm";
import { type Database, getDatabase } from "../client";

export type AppVersionsReportQuery = {
  project: string;
  organization?: string;
  range: AnalyticsOverviewRange;
  now?: Date;
};

/**
 * Mobile app-version adoption for one project. Reads existing columns only
 * (`source`, `platform`, `app_version`, `app_build`, `visitor_key`), bounded to
 * the project and the 90-day lookback ending now, so every read is served by
 * the `(project_id, occurred_at)` index. Each visitor counts once, on the
 * version of their latest event in the range (and in each chart bucket).
 */
export async function getDashboardAppVersions(
  query: AppVersionsReportQuery,
  db: Database | null = getDatabase(),
): Promise<AnalyticsAppVersionsReport> {
  if (!db) return summarizeAppVersions(getDemoAnalytics().events, query);
  const window = appVersionsWindow(query.range, query.now ?? new Date());
  const start = window.start.toISOString();
  const end = window.end.toISOString();
  const lookbackStart = window.lookbackStart.toISOString();
  const unit = appVersionsGranularity(query.range);

  const scope = sql`
    from analytics_events e
    join analytics_projects p on p.id = e.project_id
    join analytics_organizations o on o.id = p.organization_id
    where p.slug = ${query.project}
      ${query.organization ? sql`and o.slug = ${query.organization}` : sql``}
      and e.source = 'mobile'`;
  const version = sql`nullif(btrim(e.app_version), '')`;
  const inRange = sql`e.occurred_at >= ${start}::timestamptz and e.occurred_at < ${end}::timestamptz`;

  const [userRows, activityRows, trendRows] = await Promise.all([
    // Each visitor's latest mobile event in the range: platform, version, build.
    db.execute<{
      platform: string | null;
      version: string | null;
      build: string | null;
      users: number;
    }>(sql`
      with latest as (
        select distinct on (e.visitor_key)
          e.platform, ${version} as version, nullif(btrim(e.app_build), '') as build
        ${scope}
          and e.visitor_key is not null and ${inRange}
        order by e.visitor_key, e.occurred_at desc, e.id desc
      )
      select platform, version, build, count(*)::int as users
      from latest group by platform, version, build
    `),
    // Events in range plus first seen (lookback) and last seen (range) per version.
    db.execute<{
      version: string | null;
      events: number;
      users: number;
      first_seen: string;
      last_seen: string | null;
    }>(sql`
      select ${version} as version,
        count(*) filter (where e.occurred_at >= ${start}::timestamptz)::int as events,
        count(distinct e.visitor_key) filter (where e.occurred_at >= ${start}::timestamptz)::int as users,
        min(e.occurred_at) as first_seen,
        max(e.occurred_at) filter (where e.occurred_at >= ${start}::timestamptz) as last_seen
      ${scope}
        and e.occurred_at >= ${lookbackStart}::timestamptz and e.occurred_at < ${end}::timestamptz
      group by 1
    `),
    // Per UTC bucket: each visitor on the version of their latest event in it.
    db.execute<{ bucket: string; version: string | null; users: number }>(sql`
      with bucketed as (
        select date_trunc('${sql.raw(unit)}', e.occurred_at at time zone 'UTC') as bucket,
          e.visitor_key, e.occurred_at, e.id, ${version} as version
        ${scope}
          and e.visitor_key is not null and ${inRange}
      ),
      latest as (
        select distinct on (bucket, visitor_key) bucket, version
        from bucketed
        order by bucket, visitor_key, occurred_at desc, id desc
      )
      select to_char(bucket, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as bucket, version,
        count(*)::int as users
      from latest group by 1, 2
    `),
  ]);

  const iso = (value: string | Date) => new Date(value).toISOString();
  return buildAppVersionsReport({
    range: query.range,
    start: window.start,
    end: window.end,
    userRows: [...userRows],
    activityRows: activityRows.map((row) => ({
      version: row.version,
      events: row.events,
      users: row.users,
      firstSeen: iso(row.first_seen),
      lastSeen: row.last_seen ? iso(row.last_seen) : null,
    })),
    trendRows: [...trendRows],
  });
}
