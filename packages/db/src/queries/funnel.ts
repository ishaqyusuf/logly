import {
  type AnalyticsFunnel,
  type AnalyticsFunnelQuery,
  FUNNEL_MAX_SAVED_PER_PROJECT,
  FUNNEL_VISITOR_CAP,
  FUNNEL_WINDOWS,
  type FunnelBreakdown,
  type FunnelCountRow,
  type FunnelOptions,
  type FunnelStep,
  type FunnelWindow,
  formatFunnelResult,
  getDemoAnalytics,
  normalizeFunnelQuery,
  type SavedFunnel,
  type SavedFunnelInput,
  summarizeFunnel,
  summarizeFunnelOptions,
} from "@logly/utils";
import { type SQL, sql } from "drizzle-orm";
import { type Database, getDatabase } from "../client";

/** Upper bound for one funnel read; the dashboard shows the error instead. */
export const FUNNEL_STATEMENT_TIMEOUT_MS = 15_000;
const OPTIONS_LOOKBACK_DAYS = 30;
const OPTIONS_PROPERTY_SAMPLE = 5_000;

function stepMatch(alias: string, step: FunnelStep): SQL {
  const table = sql.identifier(alias);
  const parts = [sql`${table}.name = ${step.event}`];
  if (step.route) parts.push(sql`${table}.route = ${step.route}`);
  if (step.property)
    parts.push(
      sql`${table}.properties ->> ${step.property.key} = ${step.property.value}`,
    );
  return sql.join(parts, sql` and `);
}

function segmentExpression(breakdown: FunnelBreakdown | undefined): SQL {
  switch (breakdown) {
    case "platform":
      return sql`nullif(btrim(e.platform), '')`;
    case "country":
      return sql`nullif(btrim(e.country), '')`;
    case "app_version":
      return sql`nullif(btrim(e.app_version), '')`;
    case "source":
      return sql`e.source`;
    default:
      return sql`null::text`;
  }
}

/**
 * Ordered per-visitor funnel. Semantics live in `@logly/utils` funnel.ts;
 * `summarizeFunnel` is the in-memory specification this query must match.
 * Cost bounds: 2-8 steps, at most 90 days, the earliest 50,000 entrants, a
 * statement timeout, and only the steps' event names are scanned through the
 * `(project_id, name, occurred_at)` index.
 */
export async function getDashboardFunnel(
  input: AnalyticsFunnelQuery,
  db: Database | null = getDatabase(),
  visitorCap = FUNNEL_VISITOR_CAP,
): Promise<AnalyticsFunnel> {
  const query = normalizeFunnelQuery(input);
  if (!db) return summarizeFunnel(getDemoAnalytics().events, query);
  const windowSeconds = FUNNEL_WINDOWS[query.window];
  const names = [...new Set(query.steps.map((step) => step.event))];
  const grouping = query.breakdown
    ? sql`group by grouping sets ((segment), ())`
    : sql`group by ()`;
  const total = query.breakdown ? sql`grouping(segment) = 1` : sql`true`;
  const segment = query.breakdown ? sql`segment` : sql`null::text`;
  const stages: SQL[] = [
    sql`stage0 as (
      select visitor_key, entered_at, reached_at, segment, null::float8 as gap
      from entrants order by entered_at, visitor_key limit ${visitorCap}
    )`,
  ];
  for (let index = 1; index < query.steps.length; index++) {
    const step = query.steps[index] as FunnelStep;
    stages.push(sql`${sql.identifier(`stage${index}`)} as (
      select prev.visitor_key, prev.entered_at, min(ev.occurred_at) as reached_at,
        prev.segment,
        extract(epoch from min(ev.occurred_at) - prev.reached_at)::float8 as gap
      from ${sql.identifier(`stage${index - 1}`)} prev
      join scoped ev on ev.visitor_key = prev.visitor_key
        and ev.occurred_at > prev.reached_at
        and ev.occurred_at <= prev.entered_at + make_interval(secs => ${windowSeconds})
        and ${stepMatch("ev", step)}
      group by prev.visitor_key, prev.entered_at, prev.reached_at, prev.segment
    )`);
  }
  const counts = query.steps.map(
    (
      _,
      index,
    ) => sql`select ${index}::int as step, ${segment} as segment, ${total} as total,
      count(*)::int as count,
      percentile_cont(0.5) within group (order by gap) as median
    from ${sql.identifier(`stage${index}`)} ${grouping}`,
  );
  const statement = sql`
    with project as (
      select p.id from analytics_projects p
      join analytics_organizations o on o.id = p.organization_id
      where p.slug = ${query.project}
        ${query.organization ? sql`and o.slug = ${query.organization}` : sql``}
      limit 1
    ),
    scoped as (
      select e.visitor_key, e.occurred_at, e.name, e.route, e.properties,
        ${segmentExpression(query.breakdown)} as segment
      from analytics_events e
      where e.project_id = (select id from project)
        and e.visitor_key is not null
        and e.name in (${sql.join(
          names.map((name) => sql`${name}`),
          sql`, `,
        )})
        and e.occurred_at >= ${query.start}::timestamptz
        and e.occurred_at <= ${query.end}::timestamptz
    ),
    entry as (
      select distinct on (e.visitor_key) e.visitor_key,
        e.occurred_at as entered_at, e.occurred_at as reached_at, e.segment
      from scoped e
      where ${stepMatch("e", query.steps[0] as FunnelStep)}
      order by e.visitor_key, e.occurred_at
    ),
    entrants as (
      select * from entry order by entered_at, visitor_key
      limit ${visitorCap + 1}
    ),
    ${sql.join(stages, sql`, `)}
    ${sql.join(counts, sql` union all `)}
    union all
    select -1, null, true, (select count(*) from entrants)::int, null
  `;
  const result = await db.transaction(async (transaction) => {
    await transaction.execute(
      sql.raw(`set local statement_timeout = ${FUNNEL_STATEMENT_TIMEOUT_MS}`),
    );
    return transaction.execute<{
      step: number;
      segment: string | null;
      total: boolean;
      count: number;
      median: number | string | null;
    }>(statement);
  });
  const rows: FunnelCountRow[] = [];
  let entrants = 0;
  for (const row of result) {
    if (Number(row.step) === -1) {
      entrants = Number(row.count);
      continue;
    }
    rows.push({
      step: Number(row.step),
      segment: row.segment,
      total: Boolean(row.total),
      count: Number(row.count),
      medianSeconds: row.median === null ? null : Number(row.median),
    });
  }
  return formatFunnelResult(query, rows, entrants > visitorCap);
}

type SavedFunnelRow = {
  id: string;
  name: string;
  steps: FunnelStep[];
  conversion_window: string;
  created_at: Date | string;
  updated_at: Date | string;
};

function toSavedFunnel(row: SavedFunnelRow): SavedFunnel {
  return {
    id: row.id,
    name: row.name,
    steps: row.steps,
    window: (Object.hasOwn(FUNNEL_WINDOWS, row.conversion_window)
      ? row.conversion_window
      : "1d") as FunnelWindow,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export async function listSavedFunnels(
  project: string,
  db: Database | null = getDatabase(),
): Promise<SavedFunnel[]> {
  if (!db) return [];
  const rows = await db.execute<SavedFunnelRow>(sql`
    select f.id, f.name, f.steps, f.conversion_window, f.created_at, f.updated_at
    from analytics_funnels f
    join analytics_projects p on p.id = f.project_id
    where p.slug = ${project}
    order by lower(f.name), f.created_at
    limit ${FUNNEL_MAX_SAVED_PER_PROJECT}
  `);
  return rows.map(toSavedFunnel);
}

/**
 * Builder options: saved funnels plus the project's known event names (last
 * 30 days, top 200), their stored property keys (sampled from the latest
 * 5,000 events) and the top 100 recorded routes.
 */
export async function getFunnelOptions(
  project: string,
  db: Database | null = getDatabase(),
): Promise<FunnelOptions> {
  if (!db) return summarizeFunnelOptions(getDemoAnalytics().events, project);
  const since = new Date(
    Date.now() - OPTIONS_LOOKBACK_DAYS * 86_400_000,
  ).toISOString();
  const projectId = sql`(select id from analytics_projects where slug = ${project})`;
  const [funnels, names, keys, routes] = await Promise.all([
    listSavedFunnels(project, db),
    db.execute<{ name: string }>(sql`
      select name from analytics_events
      where project_id = ${projectId} and occurred_at >= ${since}::timestamptz
      group by name order by count(*) desc, name limit 200
    `),
    db.execute<{ name: string; key: string }>(sql`
      select recent.name, key
      from (
        select name, properties from analytics_events
        where project_id = ${projectId} and occurred_at >= ${since}::timestamptz
        order by occurred_at desc limit ${OPTIONS_PROPERTY_SAMPLE}
      ) recent
      cross join lateral jsonb_object_keys(
        case when jsonb_typeof(recent.properties) = 'object'
          then recent.properties else '{}'::jsonb end
      ) key
      group by recent.name, key
      order by recent.name, key
    `),
    db.execute<{ route: string }>(sql`
      select route from analytics_events
      where project_id = ${projectId} and occurred_at >= ${since}::timestamptz
        and route is not null
      group by route order by count(*) desc, route limit 100
    `),
  ]);
  const properties = new Map<string, string[]>();
  for (const row of keys) {
    if (!/^[a-z][a-z0-9_]{0,63}$/.test(row.key)) continue;
    const list = properties.get(row.name) ?? [];
    if (list.length < 50) list.push(row.key);
    properties.set(row.name, list);
  }
  return {
    funnels,
    events: names.map((row) => ({
      name: row.name,
      properties: properties.get(row.name) ?? [],
    })),
    routes: routes.map((row) => row.route),
  };
}

export type SaveFunnelResult =
  | { status: "saved"; funnel: SavedFunnel }
  | { status: "project_not_found" | "not_found" | "duplicate" | "limit" };

export async function createSavedFunnel(
  input: SavedFunnelInput,
  db: Database | null = getDatabase(),
): Promise<SaveFunnelResult> {
  if (!db) throw new Error("Saved funnels require the analytics database");
  const [project] = await db.execute<{ id: string; saved: number }>(sql`
    select p.id, (select count(*) from analytics_funnels f where f.project_id = p.id)::int as saved
    from analytics_projects p where p.slug = ${input.project} and p.enabled
  `);
  if (!project) return { status: "project_not_found" };
  if (project.saved >= FUNNEL_MAX_SAVED_PER_PROJECT) return { status: "limit" };
  const rows = await db.execute<SavedFunnelRow>(sql`
    insert into analytics_funnels (project_id, name, steps, conversion_window)
    values (${project.id}, ${input.name}, ${JSON.stringify(input.steps)}::jsonb, ${input.window})
    on conflict (project_id, name) do nothing
    returning id, name, steps, conversion_window, created_at, updated_at
  `);
  const row = rows[0];
  return row
    ? { status: "saved", funnel: toSavedFunnel(row) }
    : { status: "duplicate" };
}

export async function updateSavedFunnel(
  input: SavedFunnelInput & { id: string },
  db: Database | null = getDatabase(),
): Promise<SaveFunnelResult> {
  if (!db) throw new Error("Saved funnels require the analytics database");
  try {
    const rows = await db.execute<SavedFunnelRow>(sql`
      update analytics_funnels f
      set name = ${input.name}, steps = ${JSON.stringify(input.steps)}::jsonb,
        conversion_window = ${input.window}, updated_at = now()
      from analytics_projects p
      where p.id = f.project_id and p.slug = ${input.project}
        and f.id = ${input.id}::uuid
      returning f.id, f.name, f.steps, f.conversion_window, f.created_at, f.updated_at
    `);
    const row = rows[0];
    return row
      ? { status: "saved", funnel: toSavedFunnel(row) }
      : { status: "not_found" };
  } catch (error) {
    // 23505: another saved funnel in the project already has this name.
    const code =
      (error as { code?: string; cause?: { code?: string } }).code ??
      (error as { cause?: { code?: string } }).cause?.code;
    if (code === "23505") return { status: "duplicate" };
    throw error;
  }
}

export async function deleteSavedFunnel(
  input: { project: string; id: string },
  db: Database | null = getDatabase(),
) {
  if (!db) throw new Error("Saved funnels require the analytics database");
  const rows = await db.execute<{ id: string }>(sql`
    delete from analytics_funnels f
    using analytics_projects p
    where p.id = f.project_id and p.slug = ${input.project}
      and f.id = ${input.id}::uuid
    returning f.id
  `);
  return rows.length > 0;
}
