import {
  type AnalyticsOverviewRange,
  type AnalyticsPageEdgeRow,
  type AnalyticsPagesReport,
  type AnalyticsPageViewEvent,
  choosePageViewEvent,
  getDemoAnalytics,
  PAGES_ENTRY_EXIT_LIMIT,
  PAGES_REPORT_LIMIT,
  pagesReportWindow,
  summarizePages,
} from "@logly/utils";
import { sql } from "drizzle-orm";
import { type Database, getDatabase } from "../client";

export type PagesReportQuery = {
  project: string;
  organization?: string;
  range: AnalyticsOverviewRange;
  view?: AnalyticsPageViewEvent;
  now?: Date;
  /** Explicit window (the weekly email digest); overrides `range` and `now`. */
  window?: { start: Date; end: Date; previousStart: Date };
};

/**
 * Pages report over `page_view` (web) or `screen_view` (mobile) for one
 * project. Every read is bounded to the project, one event name and the
 * current plus previous window, so it is served by the
 * `(project_id, name, occurred_at)` index. Routes are reported exactly as
 * recorded: templates, pre-template raw paths, `/other`, or null.
 */
export async function getDashboardPages(
  query: PagesReportQuery,
  db: Database | null = getDatabase(),
): Promise<AnalyticsPagesReport> {
  if (!db) return summarizePages(getDemoAnalytics().events, query);
  const window =
    query.window ?? pagesReportWindow(query.range, query.now ?? new Date());
  const start = window.start.toISOString();
  const end = window.end.toISOString();
  const previousStart = window.previousStart.toISOString();

  const scope = sql`
    from analytics_events e
    join analytics_projects p on p.id = e.project_id
    join analytics_organizations o on o.id = p.organization_id
    where p.slug = ${query.project}
      ${query.organization ? sql`and o.slug = ${query.organization}` : sql``}`;

  const [available] = await db.execute<{
    page_view: number;
    screen_view: number;
  }>(sql`
    select count(*) filter (where e.name = 'page_view')::int as page_view,
           count(*) filter (where e.name = 'screen_view')::int as screen_view
    ${scope}
      and e.name in ('page_view', 'screen_view')
      and e.occurred_at >= ${start}::timestamptz and e.occurred_at < ${end}::timestamptz
  `);
  const counts = {
    page_view: available?.page_view ?? 0,
    screen_view: available?.screen_view ?? 0,
  };
  const view = choosePageViewEvent(counts, query.view);
  const viewScope = sql`${scope} and e.name = ${view}`;

  const [totals, pages, edges] = await Promise.all([
    db.execute<{
      views: number;
      visitors: number;
      previous_views: number;
      previous_visitors: number;
    }>(sql`
      select
        count(*) filter (where e.occurred_at >= ${start}::timestamptz)::int as views,
        count(distinct e.visitor_key) filter (where e.occurred_at >= ${start}::timestamptz)::int as visitors,
        count(*) filter (where e.occurred_at < ${start}::timestamptz)::int as previous_views,
        count(distinct e.visitor_key) filter (where e.occurred_at < ${start}::timestamptz)::int as previous_visitors
      ${viewScope}
        and e.occurred_at >= ${previousStart}::timestamptz and e.occurred_at < ${end}::timestamptz
    `),
    // Top routes by current views; previous counts come from the same scan.
    db.execute<{
      route: string | null;
      views: number;
      visitors: number;
      previous_views: number;
      previous_visitors: number;
    }>(sql`
      select e.route,
        count(*) filter (where e.occurred_at >= ${start}::timestamptz)::int as views,
        count(distinct e.visitor_key) filter (where e.occurred_at >= ${start}::timestamptz)::int as visitors,
        count(*) filter (where e.occurred_at < ${start}::timestamptz)::int as previous_views,
        count(distinct e.visitor_key) filter (where e.occurred_at < ${start}::timestamptz)::int as previous_visitors
      ${viewScope}
        and e.occurred_at >= ${previousStart}::timestamptz and e.occurred_at < ${end}::timestamptz
      group by e.route
      having count(*) filter (where e.occurred_at >= ${start}::timestamptz) > 0
      order by views desc, e.route asc nulls last
      limit ${PAGES_REPORT_LIMIT}
    `),
    // Entry/exit: first and last view per visitor per UTC day in the window.
    db.execute<{
      kind: "entry" | "exit" | "days";
      route: string | null;
      count: number;
    }>(sql`
      with ranked as (
        select e.route,
          row_number() over (partition by e.visitor_key, (e.occurred_at at time zone 'UTC')::date
                             order by e.occurred_at asc, e.id asc) as first_rank,
          row_number() over (partition by e.visitor_key, (e.occurred_at at time zone 'UTC')::date
                             order by e.occurred_at desc, e.id desc) as last_rank
        ${viewScope}
          and e.visitor_key is not null
          and e.occurred_at >= ${start}::timestamptz and e.occurred_at < ${end}::timestamptz
      ),
      entries as (
        select 'entry'::text as kind, route, count(*)::int as count
        from ranked where first_rank = 1 group by route
        order by count desc, route asc nulls last limit ${PAGES_ENTRY_EXIT_LIMIT}
      ),
      exits as (
        select 'exit'::text as kind, route, count(*)::int as count
        from ranked where last_rank = 1 group by route
        order by count desc, route asc nulls last limit ${PAGES_ENTRY_EXIT_LIMIT}
      )
      select * from entries
      union all select * from exits
      union all select 'days'::text, null, count(*)::int from ranked where first_rank = 1
    `),
  ]);

  const total = totals[0];
  const edgeRows = (kind: "entry" | "exit"): AnalyticsPageEdgeRow[] =>
    edges
      .filter((row) => row.kind === kind)
      .map((row) => ({ route: row.route, count: row.count }))
      .sort(
        (a, b) =>
          b.count - a.count ||
          (a.route === null ? 1 : b.route === null ? -1 : 0) ||
          String(a.route).localeCompare(String(b.route)),
      );
  return {
    view,
    range: query.range,
    start,
    end,
    previousStart,
    available: counts,
    totals: {
      views: total?.views ?? 0,
      visitors: total?.visitors ?? 0,
      previousViews: total?.previous_views ?? 0,
      previousVisitors: total?.previous_visitors ?? 0,
      visitorDays: edges.find((row) => row.kind === "days")?.count ?? 0,
    },
    pages: pages.map((row) => ({
      route: row.route,
      views: row.views,
      visitors: row.visitors,
      previousViews: row.previous_views,
      previousVisitors: row.previous_visitors,
    })),
    entries: edgeRows("entry"),
    exits: edgeRows("exit"),
  };
}
