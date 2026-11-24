import {
  type AnalyticsRelease,
  RELEASE_LIST_LIMIT,
  type ReleaseEnvironment,
  type ReleaseInput,
  type ReleaseSource,
} from "@logly/utils";
import { sql } from "drizzle-orm";
import { type Database, getDatabase } from "../client";

type ReleaseRow = {
  id: string;
  environment: string;
  version: string;
  deployed_at: Date | string;
  description: string | null;
  url: string | null;
  source: string;
};

function toRelease(row: ReleaseRow): AnalyticsRelease {
  return {
    id: row.id,
    environment: row.environment as ReleaseEnvironment,
    version: row.version,
    deployedAt: new Date(row.deployed_at).toISOString(),
    description: row.description,
    url: row.url,
    source: row.source as ReleaseSource,
  };
}

export type RecordReleaseResult =
  | { status: "created" | "existing"; release: AnalyticsRelease }
  | { status: "project_not_found" };

/**
 * Record a release for an enabled project. Idempotent on project, environment
 * and version: a repeat returns the stored release unchanged, so CI retries
 * never move a marker or duplicate it.
 */
export async function recordRelease(
  input: ReleaseInput & { source: ReleaseSource },
  db: Database | null = getDatabase(),
): Promise<RecordReleaseResult> {
  if (!db) throw new Error("Releases require the analytics database");
  const inserted = await db.execute<ReleaseRow>(sql`
    insert into analytics_releases
      (project_id, environment, version, deployed_at, description, url, source)
    select id, ${input.environment}, ${input.version},
      ${input.deployedAt.toISOString()}::timestamptz, ${input.description},
      ${input.url}, ${input.source}
    from analytics_projects where slug = ${input.project} and enabled
    on conflict (project_id, environment, version) do nothing
    returning id, environment, version, deployed_at, description, url, source
  `);
  const created = inserted[0];
  if (created) return { status: "created", release: toRelease(created) };

  const existing = await db.execute<ReleaseRow>(sql`
    select r.id, r.environment, r.version, r.deployed_at, r.description,
      r.url, r.source
    from analytics_releases r
    join analytics_projects p on p.id = r.project_id
    where p.slug = ${input.project} and p.enabled
      and r.environment = ${input.environment} and r.version = ${input.version}
    limit 1
  `);
  const row = existing[0];
  return row
    ? { status: "existing", release: toRelease(row) }
    : { status: "project_not_found" };
}

export type ListReleasesQuery = {
  project: string;
  start?: Date;
  end?: Date;
  environment?: ReleaseEnvironment;
  limit?: number;
};

/**
 * Releases for one project, newest first, bounded to `RELEASE_LIST_LIMIT`.
 * Served by the `(project_id, deployed_at)` index.
 */
export async function listReleases(
  query: ListReleasesQuery,
  db: Database | null = getDatabase(),
): Promise<AnalyticsRelease[]> {
  if (!db) return [];
  const limit = Math.min(
    Math.max(Math.trunc(query.limit ?? RELEASE_LIST_LIMIT), 1),
    RELEASE_LIST_LIMIT,
  );
  const rows = await db.execute<ReleaseRow>(sql`
    select r.id, r.environment, r.version, r.deployed_at, r.description,
      r.url, r.source
    from analytics_releases r
    join analytics_projects p on p.id = r.project_id
    where p.slug = ${query.project}
      ${query.start ? sql`and r.deployed_at >= ${query.start.toISOString()}::timestamptz` : sql``}
      ${query.end ? sql`and r.deployed_at < ${query.end.toISOString()}::timestamptz` : sql``}
      ${query.environment ? sql`and r.environment = ${query.environment}` : sql``}
    order by r.deployed_at desc, r.created_at desc
    limit ${limit}
  `);
  return rows.map(toRelease);
}

/** Delete one release of a project. Returns whether a row was removed. */
export async function deleteRelease(
  input: { project: string; id: string },
  db: Database | null = getDatabase(),
) {
  if (!db) throw new Error("Releases require the analytics database");
  const rows = await db.execute<{ id: string }>(sql`
    delete from analytics_releases r
    using analytics_projects p
    where p.id = r.project_id and p.slug = ${input.project}
      and r.id = ${input.id}::uuid
    returning r.id
  `);
  return rows.length > 0;
}
