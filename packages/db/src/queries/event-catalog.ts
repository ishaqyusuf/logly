import {
  type AnalyticsEventCatalog,
  buildEventCatalog,
  EVENT_CATALOG_MAX_EVENTS,
  EVENT_CATALOG_MAX_METADATA,
  EVENT_CATALOG_SAMPLE_PER_NAME,
  type EventCatalogFlags,
  type EventCatalogInput,
  type EventCatalogMetadata,
  type EventCatalogQuery,
  type EventCatalogStats,
  eventCatalogBucket,
  eventCatalogWindow,
  getDemoAnalytics,
  summarizeEventCatalog,
} from "@logly/utils";
import { sql } from "drizzle-orm";
import { type Database, getDatabase } from "../client";
import { sampleEventNames } from "./event-vocabulary";

/** Upper bound for one catalog read; the dashboard shows the error instead. */
export const EVENT_CATALOG_STATEMENT_TIMEOUT_MS = 15_000;

type MetadataRow = {
  name: string;
  description: string;
  notes: string;
  deprecated: boolean;
  hidden: boolean;
  updated_at: Date | string;
};

function toMetadata(row: MetadataRow): EventCatalogMetadata {
  return {
    name: row.name,
    description: row.description,
    notes: row.notes,
    deprecated: Boolean(row.deprecated),
    hidden: Boolean(row.hidden),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function iso(value: Date | string | null) {
  return value === null ? null : new Date(value).toISOString();
}

/**
 * The project's event catalog. `summarizeEventCatalog` in `@logly/utils` is
 * the specification. Cost bounds:
 * - names: a skip scan over `(project_id, name)`, at most 500 (+1 to detect
 *   truncation), one index probe per distinct name;
 * - first/last seen: min/max per name from `(project_id, name, occurred_at)`;
 * - volume and trend: one grouped scan of the current and previous windows
 *   (at most 60 days) through `(project_id, occurred_at)`;
 * - sources and property keys: the latest 100 events per name, shared with
 *   the funnel builder's options;
 * - metadata: at most 1,000 rows by primary key;
 * all inside a 15-second statement timeout.
 */
export async function getEventCatalog(
  query: EventCatalogQuery,
  db: Database | null = getDatabase(),
  now = new Date(),
): Promise<AnalyticsEventCatalog> {
  if (!db) return summarizeEventCatalog(getDemoAnalytics().events, query);
  const window = eventCatalogWindow(query.range, now);
  return db.transaction(async (transaction) => {
    await transaction.execute(
      sql.raw(
        `set local statement_timeout = ${EVENT_CATALOG_STATEMENT_TIMEOUT_MS}`,
      ),
    );
    const [project] = await transaction.execute<{ id: string }>(sql`
      select p.id from analytics_projects p
      join analytics_organizations o on o.id = p.organization_id
      where p.slug = ${query.project}
        ${query.organization ? sql`and o.slug = ${query.organization}` : sql``}
      limit 1
    `);
    if (!project)
      return buildEventCatalog({
        query,
        now,
        stats: [],
        metadata: [],
        truncated: false,
      });
    const projectId = sql`${project.id}::uuid`;
    const nameRows = await transaction.execute<{ name: string }>(sql`
      with recursive names(name) as (
        (select name from analytics_events
          where project_id = ${projectId} order by name limit 1)
        union all
        select (select e.name from analytics_events e
          where e.project_id = ${projectId} and e.name > names.name
          order by e.name limit 1)
        from names where names.name is not null
      )
      select name from names where name is not null
      limit ${EVENT_CATALOG_MAX_EVENTS + 1}
    `);
    const truncated = nameRows.length > EVENT_CATALOG_MAX_EVENTS;
    const names = nameRows
      .slice(0, EVENT_CATALOG_MAX_EVENTS)
      .map((row) => row.name);
    const namesJson = JSON.stringify(names);
    const [seen, volume, samples, metadata] = await Promise.all([
      transaction.execute<{
        name: string;
        first_seen: Date | string | null;
        last_seen: Date | string | null;
      }>(sql`
        select n.name,
          (select min(e.occurred_at) from analytics_events e
            where e.project_id = ${projectId} and e.name = n.name) as first_seen,
          (select max(e.occurred_at) from analytics_events e
            where e.project_id = ${projectId} and e.name = n.name) as last_seen
        from jsonb_array_elements_text(${namesJson}::jsonb) n(name)
      `),
      transaction.execute<{ name: string; bucket: number; count: number }>(sql`
        select name,
          floor(extract(epoch from occurred_at - ${window.start}::timestamptz) * 1000
            / ${window.bucketMs})::int as bucket,
          count(*)::int as count
        from analytics_events
        where project_id = ${projectId}
          and occurred_at >= ${window.previousStart}::timestamptz
          and occurred_at <= ${window.end}::timestamptz
          and name in (select jsonb_array_elements_text(${namesJson}::jsonb))
        group by 1, 2
      `),
      sampleEventNames(transaction as unknown as Database, projectId, names, {
        perName: EVENT_CATALOG_SAMPLE_PER_NAME,
      }),
      transaction.execute<MetadataRow>(sql`
        select name, description, notes, deprecated, hidden, updated_at
        from analytics_event_catalog where project_id = ${projectId}
        order by name limit ${EVENT_CATALOG_MAX_METADATA}
      `),
    ]);
    const stats = new Map<string, EventCatalogStats>();
    for (const row of seen) {
      const sample = samples.get(row.name);
      stats.set(row.name, {
        name: row.name,
        firstSeen: iso(row.first_seen),
        lastSeen: iso(row.last_seen),
        count: 0,
        previousCount: 0,
        trend: Array.from({ length: window.buckets }, () => 0),
        sources: sample?.sources ?? [],
        properties: sample?.properties ?? [],
      });
    }
    const start = Date.parse(window.start);
    for (const row of volume) {
      const entry = stats.get(row.name);
      if (!entry) continue;
      const bucket = Number(row.bucket);
      if (bucket < 0) {
        entry.previousCount += Number(row.count);
        continue;
      }
      entry.count += Number(row.count);
      // The bucket of `end` itself folds into the last one, as in the spec.
      const index = eventCatalogBucket(
        start + bucket * window.bucketMs,
        start,
        window.bucketMs,
        window.buckets,
      );
      entry.trend[index] = (entry.trend[index] ?? 0) + Number(row.count);
    }
    return buildEventCatalog({
      query,
      now,
      stats: [...stats.values()],
      metadata: metadata.map(toMetadata),
      truncated,
    });
  });
}

/** Deprecated and hidden names for pickers; empty without a database. */
export async function getEventCatalogFlags(
  project: string,
  db: Database | null = getDatabase(),
): Promise<EventCatalogFlags> {
  if (!db) return { deprecated: [], hidden: [] };
  const rows = await db.execute<{
    name: string;
    deprecated: boolean;
    hidden: boolean;
  }>(sql`
    select c.name, c.deprecated, c.hidden
    from analytics_event_catalog c
    join analytics_projects p on p.id = c.project_id
    where p.slug = ${project} and (c.deprecated or c.hidden)
    order by c.name limit ${EVENT_CATALOG_MAX_METADATA}
  `);
  return {
    deprecated: rows.filter((row) => row.deprecated).map((row) => row.name),
    hidden: rows.filter((row) => row.hidden).map((row) => row.name),
  };
}

export type SaveEventCatalogResult =
  | { status: "saved"; metadata: EventCatalogMetadata }
  | { status: "project_not_found" | "limit" };

/** Creates or replaces one event's metadata. Never touches event data. */
export async function saveEventCatalogMetadata(
  input: EventCatalogInput,
  db: Database | null = getDatabase(),
): Promise<SaveEventCatalogResult> {
  if (!db) throw new Error("The event catalog requires the analytics database");
  const [project] = await db.execute<{
    id: string;
    saved: number;
    exists: boolean;
  }>(sql`
    select p.id,
      (select count(*) from analytics_event_catalog c where c.project_id = p.id)::int as saved,
      exists (select 1 from analytics_event_catalog c
        where c.project_id = p.id and c.name = ${input.name}) as exists
    from analytics_projects p where p.slug = ${input.project} and p.enabled
  `);
  if (!project) return { status: "project_not_found" };
  if (!project.exists && project.saved >= EVENT_CATALOG_MAX_METADATA)
    return { status: "limit" };
  const [row] = await db.execute<MetadataRow>(sql`
    insert into analytics_event_catalog
      (project_id, name, description, notes, deprecated, hidden, updated_at)
    values (${project.id}, ${input.name}, ${input.description}, ${input.notes},
      ${input.deprecated}, ${input.hidden}, now())
    on conflict (project_id, name) do update set
      description = excluded.description, notes = excluded.notes,
      deprecated = excluded.deprecated, hidden = excluded.hidden,
      updated_at = now()
    returning name, description, notes, deprecated, hidden, updated_at
  `);
  if (!row) throw new Error("Event catalog upsert returned no row");
  return { status: "saved", metadata: toMetadata(row) };
}
