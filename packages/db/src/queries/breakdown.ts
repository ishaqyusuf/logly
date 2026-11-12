import {
  BREAKDOWN_NONE,
  BREAKDOWN_OTHER,
  type BreakdownBucket,
  type BreakdownDimension,
  type BreakdownQuery,
  type BreakdownResult,
  type BreakdownValues,
  breakdownDays,
} from "@logly/utils";
import { type SQL, sql } from "drizzle-orm";
import { getDatabase } from "../client";

type BreakdownRow = {
  kind: number;
  b1: string | null;
  b2: string | null;
  day: string | null;
  events: number;
  actors: number | null;
  groups: number | null;
  p50: number | null;
  p95: number | null;
  samples: number | null;
};

// Grouping-set kinds, from grouping(b1, utc_day): 0 = day×bucket, 1 = bucket,
// 2 = day total, 3 = window total.
const DAY_BUCKET = 0;
const BUCKET = 1;
const DAY_TOTAL = 2;
const TOTAL = 3;

function dimensionExpression(dimension: BreakdownDimension): SQL {
  if (dimension === "name") return sql`e.name`;
  if (dimension === "source") return sql`e.source`;
  if (dimension === "platform") return sql`e.platform`;
  return sql`e.properties ->> ${dimension.slice("property:".length)}::text`;
}

function list(values: string[]) {
  return sql`(${sql.join(
    values.map((value) => sql`${value}`),
    sql`, `,
  )})`;
}

export function breakdownConditions(query: BreakdownQuery): SQL {
  const conditions: SQL[] = [
    // Project isolation: the slug is globally unique and is the scope the
    // read credential was verified against.
    sql`p.slug = ${query.project}`,
    sql`e.occurred_at >= ${query.start}::timestamptz`,
    sql`e.occurred_at < ${query.end}::timestamptz`,
  ];
  if (query.organization) conditions.push(sql`o.slug = ${query.organization}`);
  if (query.names?.length) conditions.push(sql`e.name in ${list(query.names)}`);
  if (query.sources?.length)
    conditions.push(sql`e.source in ${list(query.sources)}`);
  if (query.platforms?.length)
    conditions.push(sql`e.platform in ${list(query.platforms)}`);
  if (query.actor) conditions.push(sql`e.actor_id = ${query.actor}`);
  if (query.groupType)
    conditions.push(
      query.groupKey
        ? sql`e.groups @> ${JSON.stringify({ [query.groupType]: { key: query.groupKey } })}::jsonb`
        : sql`e.groups ? ${query.groupType}::text`,
    );
  if (query.propertyKey && query.propertyValue !== undefined)
    conditions.push(
      sql`e.properties @> ${JSON.stringify({ [query.propertyKey]: query.propertyValue })}::jsonb`,
    );
  return sql.join(conditions, sql` and `);
}

export function buildBreakdownSql(query: BreakdownQuery): SQL {
  const [first, second] = query.by;
  if (!first) throw new Error("Breakdown requires a dimension");
  const wants = new Set(query.metrics);
  const daily = query.interval === "day";
  const durationKey = query.durationProperty;

  const topValues = (column: SQL) => sql`
    select v from (
      select ${column} as v, count(*) as n from base
      where ${column} is not null group by ${column}
    ) ranked order by n desc, v asc limit ${query.limit}`;
  const bucket = (column: SQL, top: SQL) => sql`case
      when ${column} is null then ${BREAKDOWN_NONE}::text
      when ${column} in (${top}) then ${column}
      else ${BREAKDOWN_OTHER}::text end`;

  return sql`
    with base as (
      select
        ${dimensionExpression(first)} as d1,
        ${second ? dimensionExpression(second) : sql`null::text`} as d2,
        to_char(e.occurred_at at time zone 'UTC', 'YYYY-MM-DD') as utc_day,
        e.actor_id,
        ${wants.has("groups") ? sql`e.groups -> ${query.metricGroupType}::text ->> 'key'` : sql`null::text`} as group_key,
        ${
          durationKey
            ? sql`case when jsonb_typeof(e.properties -> ${durationKey}::text) = 'number'
                then (e.properties ->> ${durationKey}::text)::double precision end`
            : sql`null::double precision`
        } as duration
      from analytics_events e
      join analytics_projects p on p.id = e.project_id
      join analytics_organizations o on o.id = p.organization_id
      where ${breakdownConditions(query)}
    ),
    bucketed as (
      select
        ${bucket(sql`base.d1`, topValues(sql`d1`))} as b1,
        ${second ? bucket(sql`base.d2`, topValues(sql`d2`)) : sql`null::text`} as b2,
        base.utc_day, base.actor_id, base.group_key, base.duration
      from base
    )
    select
      ${daily ? sql`grouping(b1, utc_day)` : sql`grouping(b1) * 2 + 1`}::int as kind,
      b1, b2, ${daily ? sql`utc_day` : sql`null::text`} as day,
      count(*)::int as events,
      ${wants.has("actors") ? sql`count(distinct actor_id)::int` : sql`null::int`} as actors,
      ${wants.has("groups") ? sql`count(distinct group_key)::int` : sql`null::int`} as groups,
      ${durationKey ? sql`percentile_cont(0.5) within group (order by duration)` : sql`null::double precision`} as p50,
      ${durationKey ? sql`percentile_cont(0.95) within group (order by duration)` : sql`null::double precision`} as p95,
      ${durationKey ? sql`count(duration)::int` : sql`null::int`} as samples
    from bucketed
    group by grouping sets (
      ${daily ? sql`(b1, b2), (), (utc_day), (utc_day, b1, b2)` : sql`(b1, b2), ()`}
    )`;
}

function values(row: BreakdownRow | undefined, query: BreakdownQuery) {
  const result: BreakdownValues = {};
  const wants = new Set(query.metrics);
  if (wants.has("events")) result.events = row?.events ?? 0;
  if (wants.has("actors")) result.actors = row?.actors ?? 0;
  if (wants.has("groups")) result.groups = row?.groups ?? 0;
  if (query.durationProperty)
    result.duration = {
      p50: row?.p50 ?? null,
      p95: row?.p95 ?? null,
      samples: row?.samples ?? 0,
    };
  return result;
}

function toBucket(row: BreakdownRow, query: BreakdownQuery): BreakdownBucket {
  const dimensions: Record<string, string> = {};
  const [first, second] = query.by;
  if (first) dimensions[first] = row.b1 ?? BREAKDOWN_NONE;
  if (second) dimensions[second] = row.b2 ?? BREAKDOWN_NONE;
  return { dimensions, ...values(row, query) };
}

// Larger buckets first; the synthetic (other)/(none) buckets sort last on ties.
function compareRows(left: BreakdownRow, right: BreakdownRow) {
  const synthetic = (row: BreakdownRow) =>
    Number(row.b1 === BREAKDOWN_OTHER || row.b2 === BREAKDOWN_OTHER);
  return (
    right.events - left.events ||
    synthetic(left) - synthetic(right) ||
    `${left.b1}\u0000${left.b2}`.localeCompare(`${right.b1}\u0000${right.b2}`)
  );
}

export function shapeBreakdownRows(
  rows: BreakdownRow[],
  query: BreakdownQuery,
): BreakdownResult {
  const of = (kind: number) => rows.filter((row) => row.kind === kind);
  const result: BreakdownResult = {
    project: query.project,
    start: query.start,
    end: query.end,
    by: query.by,
    metrics: query.metrics,
    metricGroupType: query.metrics.includes("groups")
      ? query.metricGroupType
      : null,
    interval: query.interval ?? null,
    limit: query.limit,
    durationProperty: query.durationProperty ?? null,
    totals: values(of(TOTAL)[0], query),
    buckets: of(BUCKET)
      .sort(compareRows)
      .map((row) => toBucket(row, query)),
  };
  if (query.interval === "day") {
    const totals = new Map(of(DAY_TOTAL).map((row) => [row.day, row]));
    const buckets = new Map<string, BreakdownRow[]>();
    for (const row of of(DAY_BUCKET)) {
      const day = row.day ?? "";
      buckets.set(day, [...(buckets.get(day) ?? []), row]);
    }
    // Every UTC day in the window is present so charts need no gap filling.
    result.series = breakdownDays(
      new Date(query.start),
      new Date(query.end),
    ).map((date) => ({
      date,
      totals: values(totals.get(date), query),
      buckets: (buckets.get(date) ?? [])
        .sort(compareRows)
        .map((row) => toBucket(row, query)),
    }));
  }
  return result;
}

export async function getDashboardBreakdown(
  query: BreakdownQuery,
): Promise<BreakdownResult | null> {
  const db = getDatabase();
  if (!db) return null;
  const rows = await db.execute<BreakdownRow>(buildBreakdownSql(query));
  return shapeBreakdownRows([...rows], query);
}
