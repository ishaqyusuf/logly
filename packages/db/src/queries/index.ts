import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import type { AnalyticsBatch } from "@ishaqyusuf/logly-core";
import {
  type AnalyticsEventFilterOptions,
  type AnalyticsEventPage,
  type AnalyticsEventQuery,
  type AnalyticsEventRow,
  type AnalyticsEventSummary,
  getDemoAnalytics,
  normalizeCountry,
  summarizeAnalyticsEvents,
  summarizeCountries,
} from "@logly/utils";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { getDatabase } from "../client";
import {
  analyticsEvents,
  analyticsOrganizations,
  analyticsProjectKeys,
  analyticsProjects,
} from "../schema";

export const DEFAULT_ORGANIZATION_ID = "00000000-0000-4000-8000-000000000001";

export async function createAnalyticsOrganization(input: {
  name: string;
  slug: string;
}) {
  const db = getDatabase();
  if (!db)
    throw new Error("DATABASE_URL is required to create an organization");

  const [organization] = await db
    .insert(analyticsOrganizations)
    .values(input)
    .returning({
      id: analyticsOrganizations.id,
      name: analyticsOrganizations.name,
      slug: analyticsOrganizations.slug,
    });
  if (!organization) throw new Error("Organization creation failed");
  return organization;
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function hashCredential(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function coerceDatabaseTimestamp(value: Date | string | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function encodeEventCursor(offset: number) {
  return Buffer.from(String(Math.max(0, offset))).toString("base64url");
}

export function decodeEventCursor(cursor?: string) {
  if (!cursor) return 0;
  const value = Number.parseInt(
    Buffer.from(cursor, "base64url").toString(),
    10,
  );
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

export function normalizeEventPageSize(pageSize?: number) {
  return Math.min(100, Math.max(10, pageSize ?? 50));
}

export type ProjectKeyScope =
  | "client-ingest"
  | "server-write"
  | "read"
  | "admin";

const keyPrefixes: Record<ProjectKeyScope, string> = {
  "client-ingest": "logly_ci",
  "server-write": "logly_sw",
  read: "logly_rd",
  admin: "logly_ad",
};

export function createProjectCredential(scope: ProjectKeyScope) {
  return `${keyPrefixes[scope]}_${randomBytes(24).toString("base64url")}`;
}

export async function createAnalyticsProject(input: {
  name: string;
  slug: string;
  allowedOrigins: string[];
  eventCatalog: string[];
  organizationId?: string;
}) {
  const db = getDatabase();
  if (!db) throw new Error("DATABASE_URL is required to create a project");

  const scopes: ProjectKeyScope[] = [
    "client-ingest",
    "server-write",
    "read",
    "admin",
  ];
  const credentials = scopes.map((scope) => ({
    scope,
    value: createProjectCredential(scope),
  }));

  return db.transaction(async (transaction) => {
    const [project] = await transaction
      .insert(analyticsProjects)
      .values({
        ...input,
        organizationId: input.organizationId ?? DEFAULT_ORGANIZATION_ID,
      })
      .returning({
        id: analyticsProjects.id,
        name: analyticsProjects.name,
        slug: analyticsProjects.slug,
      });
    if (!project) throw new Error("Project creation failed");

    await transaction.insert(analyticsProjectKeys).values(
      credentials.map((credential) => ({
        projectId: project.id,
        name: `${project.name} ${credential.scope}`,
        scope: credential.scope,
        keyHash: hashCredential(credential.value),
      })),
    );

    return {
      project,
      keys: Object.fromEntries(
        credentials.map((credential) => [credential.scope, credential.value]),
      ) as Record<ProjectKeyScope, string>,
    };
  });
}

export async function getProjectPolicy(projectSlug: string) {
  const db = getDatabase();
  if (!db) return null;
  const [project] = await db
    .select({
      allowedOrigins: analyticsProjects.allowedOrigins,
      enabled: analyticsProjects.enabled,
    })
    .from(analyticsProjects)
    .where(eq(analyticsProjects.slug, projectSlug))
    .limit(1);
  return project?.enabled ? project : null;
}

export async function verifyProjectCredential(
  projectSlug: string,
  credential: string,
  scope: string,
) {
  const db = getDatabase();
  if (!db)
    return scope === "client-ingest" && credential === "logly_demo_public";
  const rows = await db
    .select({ hash: analyticsProjectKeys.keyHash })
    .from(analyticsProjectKeys)
    .innerJoin(
      analyticsProjects,
      eq(analyticsProjectKeys.projectId, analyticsProjects.id),
    )
    .where(
      and(
        eq(analyticsProjects.slug, projectSlug),
        eq(analyticsProjectKeys.scope, scope),
        isNull(analyticsProjectKeys.revokedAt),
        or(
          isNull(analyticsProjectKeys.expiresAt),
          gt(analyticsProjectKeys.expiresAt, new Date()),
        ),
      ),
    )
    .limit(10);
  const candidate = hashCredential(credential);
  return rows.some((row) => safeEqual(row.hash, candidate));
}

export async function ingestEventBatch(
  batch: AnalyticsBatch,
  hashSecret: string,
  country?: string | null,
) {
  const db = getDatabase();
  if (!db)
    return {
      accepted: batch.events.length,
      duplicate: 0,
      mode: "demo" as const,
    };

  const projectSlug = batch.events[0]?.project;
  if (
    !projectSlug ||
    batch.events.some((event) => event.project !== projectSlug)
  ) {
    throw new Error("A batch may contain events for only one project");
  }
  const [project] = await db
    .select()
    .from(analyticsProjects)
    .where(
      and(
        eq(analyticsProjects.slug, projectSlug),
        eq(analyticsProjects.enabled, true),
      ),
    )
    .limit(1);
  if (!project) throw new Error("Unknown or disabled project");

  const values = batch.events.map((event) => ({
    projectId: project.id,
    eventId: event.eventId,
    name: event.name,
    version: event.version,
    source: event.source,
    platform: event.platform ?? (event.source === "browser" ? "web" : null),
    appVersion: event.appVersion ?? null,
    appBuild: event.appBuild ?? null,
    occurredAt: new Date(event.occurredAt),
    visitorKey: event.visitorId
      ? createHmac("sha256", `${hashSecret}:${project.id}`)
          .update(event.visitorId)
          .digest("hex")
      : null,
    actorId: event.actorId
      ? createHmac("sha256", `${hashSecret}:${project.id}:actor`)
          .update(event.actorId)
          .digest("hex")
      : null,
    visitKind: event.visitKind ?? null,
    route: event.route ?? null,
    referrerHost: event.referrerHost ?? null,
    country:
      event.source === "browser" || event.source === "mobile"
        ? normalizeCountry(country)
        : null,
    properties: event.properties,
    campaign: event.campaign,
  }));
  const inserted = await db
    .insert(analyticsEvents)
    .values(values)
    .onConflictDoNothing()
    .returning({ id: analyticsEvents.id });
  return {
    accepted: inserted.length,
    duplicate: values.length - inserted.length,
    mode: "database" as const,
  };
}

export async function listDashboardEvents(
  projectSlug?: string,
  organizationSlug?: string,
): Promise<AnalyticsEventRow[]> {
  const db = getDatabase();
  if (!db) return getDemoAnalytics().events;
  const rows = await db
    .select({ event: analyticsEvents, project: analyticsProjects.slug })
    .from(analyticsEvents)
    .innerJoin(
      analyticsProjects,
      eq(analyticsEvents.projectId, analyticsProjects.id),
    )
    .innerJoin(
      analyticsOrganizations,
      eq(analyticsProjects.organizationId, analyticsOrganizations.id),
    )
    .where(
      and(
        projectSlug ? eq(analyticsProjects.slug, projectSlug) : undefined,
        organizationSlug
          ? eq(analyticsOrganizations.slug, organizationSlug)
          : undefined,
      ),
    )
    .orderBy(desc(analyticsEvents.occurredAt))
    .limit(200);
  return rows.map(({ event, project }) => ({
    id: event.eventId,
    name: event.name,
    project,
    source: event.source as "browser" | "server" | "mobile",
    platform: event.platform as "web" | "ios" | "android" | null,
    appVersion: event.appVersion,
    appBuild: event.appBuild,
    visitorKey: event.visitorKey ? `v_${event.visitorKey.slice(0, 6)}` : null,
    visitKind: event.visitKind as "new" | "returning" | null,
    route: event.route,
    referrerHost: event.referrerHost,
    country: event.country,
    campaign: event.campaign,
    occurredAt: event.occurredAt.toISOString(),
    properties: event.properties,
  }));
}

function eventConditions(query: AnalyticsEventQuery) {
  const start = query.start ? new Date(query.start) : null;
  const end = query.end ? new Date(query.end) : null;
  return and(
    query.project ? eq(analyticsProjects.slug, query.project) : undefined,
    query.organization
      ? eq(analyticsOrganizations.slug, query.organization)
      : undefined,
    query.projects?.length
      ? inArray(analyticsProjects.slug, query.projects)
      : undefined,
    query.names?.length
      ? inArray(analyticsEvents.name, query.names)
      : undefined,
    query.sources?.length
      ? inArray(analyticsEvents.source, query.sources)
      : undefined,
    query.platforms?.length
      ? inArray(analyticsEvents.platform, query.platforms)
      : undefined,
    start && !Number.isNaN(start.getTime())
      ? gte(analyticsEvents.occurredAt, start)
      : undefined,
    end && !Number.isNaN(end.getTime())
      ? lte(analyticsEvents.occurredAt, end)
      : undefined,
    query.q
      ? or(
          ilike(analyticsEvents.name, `%${query.q}%`),
          ilike(analyticsProjects.slug, `%${query.q}%`),
          ilike(analyticsEvents.route, `%${query.q}%`),
          ilike(analyticsEvents.referrerHost, `%${query.q}%`),
        )
      : undefined,
  );
}

function mapDashboardEvent({
  event,
  project,
}: {
  event: typeof analyticsEvents.$inferSelect;
  project: string;
}): AnalyticsEventRow {
  return {
    id: event.eventId,
    name: event.name,
    project,
    source: event.source as "browser" | "server" | "mobile",
    platform: event.platform as "web" | "ios" | "android" | null,
    appVersion: event.appVersion,
    appBuild: event.appBuild,
    visitorKey: event.visitorKey ? `v_${event.visitorKey.slice(0, 6)}` : null,
    visitKind: event.visitKind as "new" | "returning" | null,
    route: event.route,
    referrerHost: event.referrerHost,
    country: event.country,
    campaign: event.campaign,
    occurredAt: event.occurredAt.toISOString(),
    properties: event.properties,
  };
}

export async function listDashboardEventPage(
  query: AnalyticsEventQuery = {},
): Promise<AnalyticsEventPage> {
  const pageSize = normalizeEventPageSize(query.pageSize);
  const offset = decodeEventCursor(query.cursor);
  const db = getDatabase();
  if (!db) {
    const demo = getDemoAnalytics().events.filter((event) => {
      const searchable = [
        event.name,
        event.project,
        event.route,
        event.referrerHost,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return (
        (!query.project || event.project === query.project) &&
        (!query.projects?.length || query.projects.includes(event.project)) &&
        (!query.names?.length || query.names.includes(event.name)) &&
        (!query.sources?.length || query.sources.includes(event.source)) &&
        (!query.q || searchable.includes(query.q.toLowerCase())) &&
        (!query.start || event.occurredAt >= query.start) &&
        (!query.end || event.occurredAt <= query.end)
      );
    });
    const page = demo.slice(offset, offset + pageSize);
    return {
      data: page,
      meta: {
        cursor:
          offset + page.length < demo.length
            ? encodeEventCursor(offset + page.length)
            : null,
      },
    };
  }

  const [sortField = "occurred_at", sortDirection = "desc"] =
    query.sort?.split(":") ?? [];
  const sortColumn =
    sortField === "event_name"
      ? analyticsEvents.name
      : sortField === "project"
        ? analyticsProjects.slug
        : sortField === "source"
          ? analyticsEvents.source
          : analyticsEvents.occurredAt;
  const order = sortDirection === "asc" ? asc(sortColumn) : desc(sortColumn);
  const rows = await db
    .select({ event: analyticsEvents, project: analyticsProjects.slug })
    .from(analyticsEvents)
    .innerJoin(
      analyticsProjects,
      eq(analyticsEvents.projectId, analyticsProjects.id),
    )
    .innerJoin(
      analyticsOrganizations,
      eq(analyticsProjects.organizationId, analyticsOrganizations.id),
    )
    .where(eventConditions(query))
    .orderBy(order, desc(analyticsEvents.eventId))
    .limit(pageSize + 1)
    .offset(offset);
  const hasNextPage = rows.length > pageSize;
  const page = rows.slice(0, pageSize).map(mapDashboardEvent);
  return {
    data: page,
    meta: {
      cursor: hasNextPage ? encodeEventCursor(offset + page.length) : null,
    },
  };
}

function eventRange(query: AnalyticsEventQuery) {
  const start = query.start ? new Date(query.start) : null;
  const end = query.end ? new Date(query.end) : new Date();
  if (!start || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }
  const duration = Math.max(0, end.getTime() - start.getTime());
  return {
    previousStart: new Date(start.getTime() - duration).toISOString(),
    previousEnd: new Date(start.getTime() - 1).toISOString(),
  };
}

function percentageChange(current: number, previous: number) {
  if (!previous) return current ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export async function getDashboardEventSummary(
  query: AnalyticsEventQuery,
): Promise<AnalyticsEventSummary> {
  const db = getDatabase();
  if (!db) return summarizeAnalyticsEvents(getDemoAnalytics().events, query);

  const previousRange = eventRange(query);
  const previousQuery = previousRange
    ? {
        ...query,
        start: previousRange.previousStart,
        end: previousRange.previousEnd,
      }
    : null;
  const [
    totals,
    trend,
    names,
    previousNames,
    sources,
    routes,
    acquisitionRows,
    geographyRows,
    mobilePlatformRows,
    mobileVersionRows,
  ] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(analyticsEvents)
      .innerJoin(
        analyticsProjects,
        eq(analyticsEvents.projectId, analyticsProjects.id),
      )
      .innerJoin(
        analyticsOrganizations,
        eq(analyticsProjects.organizationId, analyticsOrganizations.id),
      )
      .where(eventConditions(query)),
    db
      .select({
        date: sql<string>`to_char(date_trunc('day', ${analyticsEvents.occurredAt}), 'YYYY-MM-DD')`,
        events: sql<number>`count(*)::int`,
        visitors: sql<number>`count(distinct ${analyticsEvents.visitorKey})::int`,
      })
      .from(analyticsEvents)
      .innerJoin(
        analyticsProjects,
        eq(analyticsEvents.projectId, analyticsProjects.id),
      )
      .innerJoin(
        analyticsOrganizations,
        eq(analyticsProjects.organizationId, analyticsOrganizations.id),
      )
      .where(eventConditions(query))
      .groupBy(sql`date_trunc('day', ${analyticsEvents.occurredAt})`)
      .orderBy(sql`date_trunc('day', ${analyticsEvents.occurredAt})`),
    db
      .select({
        name: analyticsEvents.name,
        count: sql<number>`count(*)::int`,
      })
      .from(analyticsEvents)
      .innerJoin(
        analyticsProjects,
        eq(analyticsEvents.projectId, analyticsProjects.id),
      )
      .innerJoin(
        analyticsOrganizations,
        eq(analyticsProjects.organizationId, analyticsOrganizations.id),
      )
      .where(eventConditions(query))
      .groupBy(analyticsEvents.name)
      .orderBy(desc(sql`count(*)`), analyticsEvents.name),
    previousQuery
      ? db
          .select({
            name: analyticsEvents.name,
            count: sql<number>`count(*)::int`,
          })
          .from(analyticsEvents)
          .innerJoin(
            analyticsProjects,
            eq(analyticsEvents.projectId, analyticsProjects.id),
          )
          .innerJoin(
            analyticsOrganizations,
            eq(analyticsProjects.organizationId, analyticsOrganizations.id),
          )
          .where(eventConditions(previousQuery))
          .groupBy(analyticsEvents.name)
      : Promise.resolve([]),
    db
      .select({
        source: analyticsEvents.source,
        count: sql<number>`count(*)::int`,
      })
      .from(analyticsEvents)
      .innerJoin(
        analyticsProjects,
        eq(analyticsEvents.projectId, analyticsProjects.id),
      )
      .innerJoin(
        analyticsOrganizations,
        eq(analyticsProjects.organizationId, analyticsOrganizations.id),
      )
      .where(eventConditions(query))
      .groupBy(analyticsEvents.source)
      .orderBy(desc(sql`count(*)`)),
    db
      .select({
        route: analyticsEvents.route,
        count: sql<number>`count(*)::int`,
      })
      .from(analyticsEvents)
      .innerJoin(
        analyticsProjects,
        eq(analyticsEvents.projectId, analyticsProjects.id),
      )
      .innerJoin(
        analyticsOrganizations,
        eq(analyticsProjects.organizationId, analyticsOrganizations.id),
      )
      .where(and(eventConditions(query), isNotNull(analyticsEvents.route)))
      .groupBy(analyticsEvents.route)
      .orderBy(desc(sql`count(*)`))
      .limit(10),
    db
      .select({
        referrer: sql<string>`coalesce(nullif(${analyticsEvents.referrerHost}, ''), 'Direct / unknown')`,
        campaignSource: sql<string>`coalesce(nullif(${analyticsEvents.campaign}->>'source', ''), 'Unattributed')`,
        count: sql<number>`count(*)::int`,
      })
      .from(analyticsEvents)
      .innerJoin(
        analyticsProjects,
        eq(analyticsEvents.projectId, analyticsProjects.id),
      )
      .innerJoin(
        analyticsOrganizations,
        eq(analyticsProjects.organizationId, analyticsOrganizations.id),
      )
      .where(
        and(
          eventConditions(query),
          eq(analyticsEvents.name, "site_visit"),
          eq(analyticsEvents.source, "browser"),
        ),
      )
      .groupBy(
        sql`coalesce(nullif(${analyticsEvents.referrerHost}, ''), 'Direct / unknown')`,
        sql`coalesce(nullif(${analyticsEvents.campaign}->>'source', ''), 'Unattributed')`,
      ),
    db
      .select({
        country: analyticsEvents.country,
        count: sql<number>`count(*)::int`,
      })
      .from(analyticsEvents)
      .innerJoin(
        analyticsProjects,
        eq(analyticsEvents.projectId, analyticsProjects.id),
      )
      .innerJoin(
        analyticsOrganizations,
        eq(analyticsProjects.organizationId, analyticsOrganizations.id),
      )
      .where(
        and(
          eventConditions(query),
          or(
            and(
              eq(analyticsEvents.name, "site_visit"),
              eq(analyticsEvents.source, "browser"),
            ),
            and(
              eq(analyticsEvents.name, "app_session"),
              eq(analyticsEvents.source, "mobile"),
            ),
          ),
        ),
      )
      .groupBy(analyticsEvents.country),
    db
      .select({
        platform: analyticsEvents.platform,
        sessions: sql<number>`count(*) filter (where ${analyticsEvents.name} = 'app_session')::int`,
        events: sql<number>`count(*)::int`,
        installations: sql<number>`count(distinct ${analyticsEvents.visitorKey})::int`,
      })
      .from(analyticsEvents)
      .innerJoin(
        analyticsProjects,
        eq(analyticsEvents.projectId, analyticsProjects.id),
      )
      .innerJoin(
        analyticsOrganizations,
        eq(analyticsProjects.organizationId, analyticsOrganizations.id),
      )
      .where(
        and(
          eventConditions(query),
          eq(analyticsEvents.source, "mobile"),
          inArray(analyticsEvents.platform, ["ios", "android"]),
        ),
      )
      .groupBy(analyticsEvents.platform),
    db
      .select({
        platform: analyticsEvents.platform,
        version: analyticsEvents.appVersion,
        build: analyticsEvents.appBuild,
        sessions: sql<number>`count(*) filter (where ${analyticsEvents.name} = 'app_session')::int`,
        events: sql<number>`count(*)::int`,
      })
      .from(analyticsEvents)
      .innerJoin(
        analyticsProjects,
        eq(analyticsEvents.projectId, analyticsProjects.id),
      )
      .innerJoin(
        analyticsOrganizations,
        eq(analyticsProjects.organizationId, analyticsOrganizations.id),
      )
      .where(
        and(
          eventConditions(query),
          eq(analyticsEvents.source, "mobile"),
          inArray(analyticsEvents.platform, ["ios", "android"]),
        ),
      )
      .groupBy(
        analyticsEvents.platform,
        analyticsEvents.appVersion,
        analyticsEvents.appBuild,
      )
      .orderBy(
        desc(
          sql`count(*) filter (where ${analyticsEvents.name} = 'app_session')`,
        ),
        desc(sql`count(*)`),
      ),
  ]);
  const acquisitionGroups = (key: "referrer" | "campaignSource") => {
    const counts = new Map<string, number>();
    for (const row of acquisitionRows) {
      counts.set(row[key], (counts.get(row[key]) ?? 0) + row.count);
    }
    return [...counts]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  };
  const previousByName = new Map(
    previousNames.map((event) => [event.name, event.count]),
  );

  return {
    totalEvents: totals[0]?.count ?? 0,
    geography: summarizeCountries(geographyRows),
    acquisition: {
      totalVisits: acquisitionRows.reduce((total, row) => total + row.count, 0),
      referrers: acquisitionGroups("referrer"),
      campaignSources: acquisitionGroups("campaignSource"),
    },
    mobile: {
      totalSessions: mobilePlatformRows.reduce(
        (total, row) => total + row.sessions,
        0,
      ),
      totalEvents: mobilePlatformRows.reduce(
        (total, row) => total + row.events,
        0,
      ),
      uniqueInstallations: mobilePlatformRows.reduce(
        (total, row) => total + row.installations,
        0,
      ),
      platforms: mobilePlatformRows.flatMap((row) =>
        row.platform === "ios" || row.platform === "android"
          ? [{ ...row, platform: row.platform }]
          : [],
      ),
      versions: mobileVersionRows.flatMap((row) =>
        row.platform === "ios" || row.platform === "android"
          ? [
              {
                platform: row.platform,
                version: row.version || "Unknown version",
                build: row.build,
                sessions: row.sessions,
                events: row.events,
              },
            ]
          : [],
      ),
    },
    uniqueEventNames: names.length,
    trend,
    eventNames: names.map((event) => {
      const previousCount = previousByName.get(event.name) ?? 0;
      return {
        ...event,
        previousCount,
        change: percentageChange(event.count, previousCount),
      };
    }),
    sources: sources.filter(
      (
        event,
      ): event is {
        source: "browser" | "server" | "mobile";
        count: number;
      } =>
        event.source === "browser" ||
        event.source === "server" ||
        event.source === "mobile",
    ),
    routes: routes.flatMap((event) =>
      event.route ? [{ route: event.route, count: event.count }] : [],
    ),
  };
}

export async function getDashboardEventById(
  eventId: string,
  projectSlug: string,
): Promise<AnalyticsEventRow | null> {
  const db = getDatabase();
  if (!db) {
    return (
      getDemoAnalytics().events.find(
        (event) => event.id === eventId && event.project === projectSlug,
      ) ?? null
    );
  }
  const [row] = await db
    .select({ event: analyticsEvents, project: analyticsProjects.slug })
    .from(analyticsEvents)
    .innerJoin(
      analyticsProjects,
      eq(analyticsEvents.projectId, analyticsProjects.id),
    )
    .where(
      and(
        eq(analyticsEvents.eventId, eventId),
        eq(analyticsProjects.slug, projectSlug),
      ),
    )
    .limit(1);
  return row ? mapDashboardEvent(row) : null;
}

export async function getDashboardEventFilterOptions(
  query: Pick<AnalyticsEventQuery, "organization" | "project"> = {},
): Promise<AnalyticsEventFilterOptions> {
  const db = getDatabase();
  if (!db) {
    const events = getDemoAnalytics().events.filter(
      (event) => !query.project || event.project === query.project,
    );
    return {
      projects: [...new Set(events.map((event) => event.project))].sort(),
      names: [...new Set(events.map((event) => event.name))].sort(),
      sources: [...new Set(events.map((event) => event.source))].sort(),
      platforms: [
        ...new Set(
          events.flatMap((event) => (event.platform ? [event.platform] : [])),
        ),
      ].sort(),
    };
  }
  const rows = await db
    .select({
      project: analyticsProjects.slug,
      name: analyticsEvents.name,
      source: analyticsEvents.source,
      platform: analyticsEvents.platform,
    })
    .from(analyticsEvents)
    .innerJoin(
      analyticsProjects,
      eq(analyticsEvents.projectId, analyticsProjects.id),
    )
    .innerJoin(
      analyticsOrganizations,
      eq(analyticsProjects.organizationId, analyticsOrganizations.id),
    )
    .where(
      and(
        query.project ? eq(analyticsProjects.slug, query.project) : undefined,
        query.organization
          ? eq(analyticsOrganizations.slug, query.organization)
          : undefined,
      ),
    );
  return {
    projects: [...new Set(rows.map((row) => row.project))].sort(),
    names: [...new Set(rows.map((row) => row.name))].sort(),
    sources: [...new Set(rows.map((row) => row.source))]
      .filter(
        (source): source is "browser" | "server" | "mobile" =>
          source === "browser" || source === "server" || source === "mobile",
      )
      .sort(),
    platforms: [...new Set(rows.map((row) => row.platform))]
      .filter(
        (platform): platform is "web" | "ios" | "android" =>
          platform === "web" || platform === "ios" || platform === "android",
      )
      .sort(),
  };
}

export async function getDashboardData(
  projectSlug?: string,
  organizationSlug?: string,
) {
  const db = getDatabase();
  if (!db) {
    const demo = getDemoAnalytics();
    const allowedProjects = new Set(
      demo.projects
        .filter(
          (project) =>
            (!projectSlug || project.slug === projectSlug) &&
            (!organizationSlug ||
              project.organizationSlug === organizationSlug),
        )
        .map((project) => project.slug),
    );
    const events = demo.events.filter((event) =>
      allowedProjects.has(event.project),
    );
    const summary = summarizeAnalyticsEvents(events, {});
    const visitorEvents = events.filter((event) => event.visitorKey);
    return {
      ...demo,
      mode: "demo" as const,
      events,
      overview: {
        uniqueVisitors: new Set(visitorEvents.map((event) => event.visitorKey))
          .size,
        newVisitors: events.filter(
          (event) => event.name === "site_visit" && event.visitKind === "new",
        ).length,
        returningVisitors: events.filter(
          (event) =>
            event.name === "site_visit" && event.visitKind === "returning",
        ).length,
        totalEvents: events.length,
        deliveryRate: null,
        collectionHealth: {
          recentEvents: 0,
          lastReceivedAt: null,
          averageLagSeconds: null,
          clockSkewEvents: 0,
        },
        change: { visitors: 0, events: 0 },
        trend: summary.trend,
        topEvents: summary.eventNames.slice(0, 5).map(({ name, count }) => ({
          name,
          count,
        })),
      },
    };
  }
  const events = await listDashboardEvents(projectSlug, organizationSlug);
  const projectFilter = and(
    projectSlug ? eq(analyticsProjects.slug, projectSlug) : undefined,
    organizationSlug
      ? eq(analyticsOrganizations.slug, organizationSlug)
      : undefined,
  );
  const healthStart = new Date(Date.now() - 86_400_000).toISOString();
  const [health] = await db
    .select({
      recentEvents: sql<number>`count(*) filter (where ${analyticsEvents.receivedAt} >= ${healthStart})::int`,
      lastReceivedAt: sql<
        Date | string | null
      >`max(${analyticsEvents.receivedAt})`,
      averageLagSeconds: sql<
        number | null
      >`avg(extract(epoch from (${analyticsEvents.receivedAt} - ${analyticsEvents.occurredAt}))) filter (where ${analyticsEvents.receivedAt} >= ${healthStart} and ${analyticsEvents.receivedAt} >= ${analyticsEvents.occurredAt})::float8`,
      clockSkewEvents: sql<number>`count(*) filter (where ${analyticsEvents.receivedAt} >= ${healthStart} and ${analyticsEvents.occurredAt} > ${analyticsEvents.receivedAt})::int`,
    })
    .from(analyticsEvents)
    .innerJoin(
      analyticsProjects,
      eq(analyticsEvents.projectId, analyticsProjects.id),
    )
    .innerJoin(
      analyticsOrganizations,
      eq(analyticsProjects.organizationId, analyticsOrganizations.id),
    )
    .where(projectFilter);
  const [overview] = await db
    .select({
      uniqueVisitors: sql<number>`count(distinct ${analyticsEvents.visitorKey})::int`,
      newVisitors: sql<number>`count(*) filter (where ${analyticsEvents.name} = 'site_visit' and ${analyticsEvents.visitKind} = 'new')::int`,
      returningVisitors: sql<number>`count(*) filter (where ${analyticsEvents.name} = 'site_visit' and ${analyticsEvents.visitKind} = 'returning')::int`,
      totalEvents: sql<number>`count(*)::int`,
    })
    .from(analyticsEvents)
    .innerJoin(
      analyticsProjects,
      eq(analyticsEvents.projectId, analyticsProjects.id),
    )
    .innerJoin(
      analyticsOrganizations,
      eq(analyticsProjects.organizationId, analyticsOrganizations.id),
    )
    .where(projectFilter);

  const trendStart = new Date();
  trendStart.setUTCHours(0, 0, 0, 0);
  trendStart.setUTCDate(trendStart.getUTCDate() - 13);
  const [trend, topEvents] = await Promise.all([
    db
      .select({
        date: sql<string>`to_char(date_trunc('day', ${analyticsEvents.occurredAt}), 'YYYY-MM-DD')`,
        events: sql<number>`count(*)::int`,
        visitors: sql<number>`count(distinct ${analyticsEvents.visitorKey})::int`,
      })
      .from(analyticsEvents)
      .innerJoin(
        analyticsProjects,
        eq(analyticsEvents.projectId, analyticsProjects.id),
      )
      .innerJoin(
        analyticsOrganizations,
        eq(analyticsProjects.organizationId, analyticsOrganizations.id),
      )
      .where(and(projectFilter, gte(analyticsEvents.occurredAt, trendStart)))
      .groupBy(sql`date_trunc('day', ${analyticsEvents.occurredAt})`)
      .orderBy(sql`date_trunc('day', ${analyticsEvents.occurredAt})`),
    db
      .select({ name: analyticsEvents.name, count: sql<number>`count(*)::int` })
      .from(analyticsEvents)
      .innerJoin(
        analyticsProjects,
        eq(analyticsEvents.projectId, analyticsProjects.id),
      )
      .innerJoin(
        analyticsOrganizations,
        eq(analyticsProjects.organizationId, analyticsOrganizations.id),
      )
      .where(projectFilter)
      .groupBy(analyticsEvents.name)
      .orderBy(desc(sql`count(*)`))
      .limit(5),
  ]);

  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);
  const projects = await db
    .select({
      id: analyticsProjects.id,
      organizationId: analyticsOrganizations.id,
      organizationSlug: analyticsOrganizations.slug,
      slug: analyticsProjects.slug,
      name: analyticsProjects.name,
      allowedOrigins: analyticsProjects.allowedOrigins,
      eventsToday: sql<number>`count(${analyticsEvents.id}) filter (where ${gte(analyticsEvents.occurredAt, startOfToday)})::int`,
      visitorsToday: sql<number>`count(distinct ${analyticsEvents.visitorKey}) filter (where ${gte(analyticsEvents.occurredAt, startOfToday)})::int`,
      lastEventAt: sql<Date | null>`max(${analyticsEvents.occurredAt})`,
    })
    .from(analyticsProjects)
    .innerJoin(
      analyticsOrganizations,
      eq(analyticsProjects.organizationId, analyticsOrganizations.id),
    )
    .leftJoin(
      analyticsEvents,
      eq(analyticsEvents.projectId, analyticsProjects.id),
    )
    .where(projectFilter)
    .groupBy(analyticsProjects.id, analyticsOrganizations.id)
    .orderBy(analyticsProjects.name);
  const organizations = await db
    .select({
      id: analyticsOrganizations.id,
      slug: analyticsOrganizations.slug,
      name: analyticsOrganizations.name,
      projectCount: sql<number>`count(${analyticsProjects.id})::int`,
    })
    .from(analyticsOrganizations)
    .leftJoin(
      analyticsProjects,
      eq(analyticsProjects.organizationId, analyticsOrganizations.id),
    )
    .groupBy(analyticsOrganizations.id)
    .orderBy(analyticsOrganizations.name);
  return {
    mode: "database" as const,
    overview: {
      uniqueVisitors: overview?.uniqueVisitors ?? 0,
      newVisitors: overview?.newVisitors ?? 0,
      returningVisitors: overview?.returningVisitors ?? 0,
      totalEvents: overview?.totalEvents ?? 0,
      deliveryRate: null,
      collectionHealth: {
        recentEvents: health?.recentEvents ?? 0,
        lastReceivedAt:
          coerceDatabaseTimestamp(
            health?.lastReceivedAt ?? null,
          )?.toISOString() ?? null,
        averageLagSeconds: health?.averageLagSeconds ?? null,
        clockSkewEvents: health?.clockSkewEvents ?? 0,
      },
      change: { visitors: 0, events: 0 },
      trend,
      topEvents,
    },
    events,
    organizations,
    projects: projects.map((project) => {
      const lastEventAt = coerceDatabaseTimestamp(project.lastEventAt);
      return {
        id: project.id,
        organizationId: project.organizationId,
        organizationSlug: project.organizationSlug,
        slug: project.slug,
        name: project.name,
        origin: project.allowedOrigins[0] ?? "Not configured",
        status: lastEventAt
          ? Date.now() - lastEventAt.getTime() < 24 * 60 * 60 * 1000
            ? ("healthy" as const)
            : ("quiet" as const)
          : ("attention" as const),
        eventsToday: project.eventsToday,
        visitorsToday: project.visitorsToday,
        lastEventAt: lastEventAt?.toISOString() ?? null,
      };
    }),
  };
}

export { getDashboardFunnel } from "./funnel";
