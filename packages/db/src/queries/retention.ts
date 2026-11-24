import {
  type AnalyticsRetentionReport,
  buildRetentionReport,
  getDemoAnalytics,
  normalizeRetentionReturnEvent,
  type RetentionRange,
  type RetentionSurface,
  retentionEntryEvents,
  retentionStepMs,
  retentionWindow,
  summarizeRetention,
} from "@logly/utils";
import { sql } from "drizzle-orm";
import { type Database, getDatabase } from "../client";

export type RetentionReportQuery = {
  project: string;
  organization?: string;
  range: RetentionRange;
  surface?: RetentionSurface;
  returnEvent?: string | null;
  now?: Date;
};

/**
 * Cohort retention for one project. Two bounded reads:
 *
 * - Surfaces: two `exists` probes on the `(project_id, name, occurred_at)`
 *   index for `site_visit` and `app_session` in the lookback.
 * - Cohorts: first entry event per visitor over the lookback plus the cohort
 *   window (at most 90 days + 12 weeks of entry events, the same index), then
 *   returning activity for those visitors from the first cohort to now
 *   (`(project_id, occurred_at)`, or `(project_id, name, occurred_at)` when a
 *   returning event is chosen). No new index or migration.
 */
export async function getDashboardRetention(
  query: RetentionReportQuery,
  db: Database | null = getDatabase(),
): Promise<AnalyticsRetentionReport> {
  const surface = query.surface ?? "all";
  const returnEvent = normalizeRetentionReturnEvent(query.returnEvent);
  const now = query.now ?? new Date();
  if (!db)
    return summarizeRetention(getDemoAnalytics().events, {
      ...query,
      surface,
      returnEvent,
      now,
    });
  const window = retentionWindow(query.range, now);
  const start = window.start.toISOString();
  const end = window.end.toISOString();
  const lookbackStart = window.lookbackStart.toISOString();
  const unit = sql.raw(window.granularity === "day" ? "'day'" : "'week'");
  const stepSeconds = retentionStepMs(window.granularity) / 1000;
  const entryNames = retentionEntryEvents(surface);

  const project = sql`
    select p.id from analytics_projects p
    join analytics_organizations o on o.id = p.organization_id
    where p.slug = ${query.project}
      ${query.organization ? sql`and o.slug = ${query.organization}` : sql``}
    limit 1`;
  const sourceFilter =
    surface === "all"
      ? sql``
      : surface === "mobile"
        ? sql`and e.source = 'mobile'`
        : sql`and e.source <> 'mobile'`;
  const entryFilter = sql.join(
    entryNames.map((name) => sql`${name}`),
    sql`, `,
  );

  const [surfaceRows, cohortRows] = await Promise.all([
    db.execute<{ web: boolean; mobile: boolean }>(sql`
      with project as (${project})
      select
        exists (
          select 1 from analytics_events e
          where e.project_id = (select id from project) and e.name = 'site_visit'
            and e.occurred_at >= ${lookbackStart}::timestamptz
            and e.occurred_at < ${end}::timestamptz
        ) as web,
        exists (
          select 1 from analytics_events e
          where e.project_id = (select id from project) and e.name = 'app_session'
            and e.occurred_at >= ${lookbackStart}::timestamptz
            and e.occurred_at < ${end}::timestamptz
        ) as mobile
    `),
    db.execute<{ cohort: string; period: number; users: number }>(sql`
      with project as (${project}),
      entries as (
        select e.visitor_key, min(e.occurred_at) as first_seen
        from analytics_events e
        where e.project_id = (select id from project)
          and e.name in (${entryFilter})
          ${sourceFilter}
          and e.visitor_key is not null
          and e.occurred_at >= ${lookbackStart}::timestamptz
          and e.occurred_at < ${end}::timestamptz
        group by e.visitor_key
      ),
      cohorts as (
        select visitor_key,
          date_trunc(${unit}, first_seen at time zone 'UTC') as cohort
        from entries
        where first_seen >= ${start}::timestamptz
      ),
      activity as (
        select distinct c.cohort, c.visitor_key,
          round((extract(epoch from date_trunc(${unit}, e.occurred_at at time zone 'UTC'))
            - extract(epoch from c.cohort)) / ${stepSeconds})::int as period
        from analytics_events e
        join cohorts c on c.visitor_key = e.visitor_key
        where e.project_id = (select id from project)
          ${sourceFilter}
          ${returnEvent ? sql`and e.name = ${returnEvent}` : sql``}
          and e.occurred_at >= ${start}::timestamptz
          and e.occurred_at < ${end}::timestamptz
      )
      select to_char(cohort, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as cohort, 0 as period,
        count(*)::int as users
      from cohorts group by cohort
      union all
      select to_char(cohort, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as cohort, period,
        count(*)::int as users
      from activity
      where period >= 1 and period < ${window.periods}
      group by cohort, period
    `),
  ]);

  const flags = surfaceRows[0];
  return buildRetentionReport({
    range: query.range,
    surface,
    returnEvent,
    now,
    surfaces: { web: Boolean(flags?.web), mobile: Boolean(flags?.mobile) },
    cohortRows: cohortRows
      .filter((row) => Number(row.period) === 0)
      .map((row) => ({ cohort: row.cohort, users: row.users })),
    activityRows: cohortRows
      .filter((row) => Number(row.period) > 0)
      .map((row) => ({
        cohort: row.cohort,
        period: Number(row.period),
        users: row.users,
      })),
  });
}
