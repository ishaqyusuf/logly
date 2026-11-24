import {
  cleanEventPropertyKeys,
  type EventCatalogSource,
  sortEventCatalogSources,
} from "@logly/utils";
import { type SQL, sql } from "drizzle-orm";
import type { Database } from "../client";

/**
 * Event and property discovery shared by the funnel builder's options and the
 * event catalog. Everything here reads through the
 * `(project_id, name, occurred_at)` index and is bounded by its arguments.
 */

/** A project's event names by volume since `since`, at most `limit`. */
export async function listEventNamesByVolume(
  db: Database,
  projectId: SQL,
  options: { since: string; limit: number },
) {
  const rows = await db.execute<{ name: string }>(sql`
    select name from analytics_events
    where project_id = ${projectId} and occurred_at >= ${options.since}::timestamptz
    group by name order by count(*) desc, name limit ${options.limit}
  `);
  return rows.map((row) => row.name);
}

/**
 * Sources and property keys per name, sampled from each name's latest
 * `perName` events (optionally since `since`). Stratified per name, so a
 * low-volume event is not drowned out by a busy one.
 */
export async function sampleEventNames(
  db: Database,
  projectId: SQL,
  names: string[],
  options: { perName: number; since?: string },
) {
  const result = new Map<
    string,
    { sources: EventCatalogSource[]; properties: string[] }
  >();
  if (!names.length) return result;
  const since = options.since
    ? sql`and e.occurred_at >= ${options.since}::timestamptz`
    : sql``;
  const rows = await db.execute<{
    name: string;
    sources: string[] | null;
    keys: string[] | null;
  }>(sql`
    select n.name,
      array_agg(distinct s.source) as sources,
      array_agg(distinct k.key) filter (where k.key is not null) as keys
    from jsonb_array_elements_text(${JSON.stringify(names)}::jsonb) n(name)
    cross join lateral (
      select e.source, e.properties from analytics_events e
      where e.project_id = ${projectId} and e.name = n.name ${since}
      order by e.occurred_at desc, e.id desc
      limit ${options.perName}
    ) s
    left join lateral jsonb_object_keys(
      case when jsonb_typeof(s.properties) = 'object'
        then s.properties else '{}'::jsonb end
    ) k(key) on true
    group by n.name
  `);
  for (const row of rows)
    result.set(row.name, {
      sources: sortEventCatalogSources(row.sources ?? []),
      properties: cleanEventPropertyKeys(row.keys ?? []),
    });
  return result;
}
