import {
  type AnalyticsFunnelQuery,
  formatFunnelCounts,
  getDemoAnalytics,
  normalizeFunnelQuery,
  summarizeFunnel,
} from "@logly/utils";
import { sql } from "drizzle-orm";
import { getDatabase } from "../client";

export async function getDashboardFunnel(input: AnalyticsFunnelQuery) {
  const query = normalizeFunnelQuery(input);
  const db = getDatabase();
  if (!db) return summarizeFunnel(getDemoAnalytics().events, query);
  const stages = [
    sql`stage0 as (
    select visitor_key, day, min(occurred_at) as reached_at
    from scoped where name = ${query.steps[0]}
    group by visitor_key, day
  )`,
  ];
  for (let index = 1; index < query.steps.length; index++) {
    const previous = sql.identifier(`stage${index - 1}`);
    stages.push(sql`${sql.identifier(`stage${index}`)} as (
      select previous.visitor_key, previous.day, min(event.occurred_at) as reached_at
      from ${previous} previous
      join scoped event on event.visitor_key = previous.visitor_key and event.day = previous.day
        and event.occurred_at > previous.reached_at and event.name = ${query.steps[index]}
      group by previous.visitor_key, previous.day
    )`);
  }
  const result = await db.execute<{ step: number; count: number }>(sql`
    with scoped as (
      select e.visitor_key, (e.occurred_at at time zone 'UTC')::date as day, e.occurred_at, e.name
      from analytics_events e
      join analytics_projects p on p.id = e.project_id
      join analytics_organizations o on o.id = p.organization_id
      where p.slug = ${query.project}
        ${query.organization ? sql`and o.slug = ${query.organization}` : sql``}
        and e.source = 'browser' and e.visitor_key is not null
        and e.occurred_at >= ${query.start}::timestamptz and e.occurred_at <= ${query.end}::timestamptz
        and e.name in (${sql.join(
          query.steps.map((step) => sql`${step}`),
          sql`, `,
        )})
    ), ${sql.join(stages, sql`, `)}
    ${sql.join(
      query.steps.map(
        (_, index) =>
          sql`select ${index}::int as step, count(*)::int as count from ${sql.identifier(`stage${index}`)}`,
      ),
      sql` union all `,
    )}
    order by step
  `);
  return formatFunnelCounts(
    query,
    result.map((row) => row.count),
  );
}
