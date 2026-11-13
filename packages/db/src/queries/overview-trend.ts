import type {
  AnalyticsOverviewRange,
  AnalyticsTrendGranularity,
  AnalyticsTrendPoint,
} from "@logly/utils";
import { and, desc, eq, gte, inArray, lt, type SQL, sql } from "drizzle-orm";
import type { Database } from "../client";
import {
  analyticsEvents,
  analyticsOrganizations,
  analyticsProjects,
} from "../schema";

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/** The 24-hour Overview needs hourly buckets; longer windows read by day. */
export function overviewTrendGranularity(
  range?: AnalyticsOverviewRange,
): AnalyticsTrendGranularity {
  return range === "24h" ? "hour" : "day";
}

function truncateUtc(date: Date, granularity: AnalyticsTrendGranularity) {
  const bucket = new Date(date);
  if (granularity === "hour") bucket.setUTCMinutes(0, 0, 0);
  else bucket.setUTCHours(0, 0, 0, 0);
  return bucket;
}

export function trendBucketKey(
  date: Date,
  granularity: AnalyticsTrendGranularity,
) {
  const iso = date.toISOString();
  return granularity === "hour"
    ? `${iso.slice(0, 13)}:00:00Z`
    : iso.slice(0, 10);
}

/** UTC bucket keys from the bucket containing `start` through the one containing `end`. */
export function trendBucketKeys(
  start: Date,
  end: Date,
  granularity: AnalyticsTrendGranularity,
) {
  const step = granularity === "hour" ? HOUR_MS : DAY_MS;
  const keys: string[] = [];
  for (
    let time = truncateUtc(start, granularity).getTime();
    time <= end.getTime();
    time += step
  ) {
    keys.push(trendBucketKey(new Date(time), granularity));
  }
  return keys;
}

/** Zero-fills missing buckets so current and previous windows stay index-aligned. */
export function fillTrendBuckets(
  rows: AnalyticsTrendPoint[],
  keys: string[],
): AnalyticsTrendPoint[] {
  const byDate = new Map(rows.map((row) => [row.date, row]));
  return keys.map((date) => {
    const row = byDate.get(date);
    return {
      date,
      events: row?.events ?? 0,
      visitors: row?.visitors ?? 0,
      newVisitors: row?.newVisitors ?? 0,
      returningVisitors: row?.returningVisitors ?? 0,
    };
  });
}

type ProjectFilter = SQL | undefined;

async function selectTrendBuckets(
  db: Database,
  projectFilter: ProjectFilter,
  window: { start: Date; end?: Date },
  granularity: AnalyticsTrendGranularity,
) {
  // Bucket in UTC regardless of the database session time zone.
  const bucket =
    granularity === "hour"
      ? sql`date_trunc('hour', ${analyticsEvents.occurredAt} at time zone 'UTC')`
      : sql`date_trunc('day', ${analyticsEvents.occurredAt} at time zone 'UTC')`;
  const label =
    granularity === "hour"
      ? sql<string>`to_char(${bucket}, 'YYYY-MM-DD"T"HH24":00:00Z"')`
      : sql<string>`to_char(${bucket}, 'YYYY-MM-DD')`;
  return db
    .select({
      date: label,
      events: sql<number>`count(*)::int`,
      visitors: sql<number>`count(distinct ${analyticsEvents.visitorKey})::int`,
      newVisitors: sql<number>`count(*) filter (where ${analyticsEvents.name} = 'site_visit' and ${analyticsEvents.visitKind} = 'new')::int`,
      returningVisitors: sql<number>`count(*) filter (where ${analyticsEvents.name} = 'site_visit' and ${analyticsEvents.visitKind} = 'returning')::int`,
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
        projectFilter,
        gte(analyticsEvents.occurredAt, window.start),
        window.end ? lt(analyticsEvents.occurredAt, window.end) : undefined,
      ),
    )
    .groupBy(bucket)
    .orderBy(bucket);
}

/**
 * Overview trend for the selected window plus, when a range is selected, the
 * immediately preceding equal window. Without a range the legacy 14-day daily
 * trend is returned and no previous series exists.
 */
export async function getOverviewTrend(
  db: Database,
  projectFilter: ProjectFilter,
  input: {
    range?: AnalyticsOverviewRange;
    rangeStart?: Date;
    previousStart?: Date;
    now?: Date;
  },
) {
  const now = input.now ?? new Date();
  const granularity = overviewTrendGranularity(input.range);
  const start =
    input.rangeStart ??
    new Date(truncateUtc(now, "day").getTime() - 13 * DAY_MS);
  const previous =
    input.rangeStart && input.previousStart
      ? { start: input.previousStart, end: input.rangeStart }
      : null;
  const [current, prior] = await Promise.all([
    selectTrendBuckets(db, projectFilter, { start }, granularity),
    previous
      ? selectTrendBuckets(db, projectFilter, previous, granularity)
      : Promise.resolve(null),
  ]);
  return {
    trendGranularity: granularity,
    trend: fillTrendBuckets(current, trendBucketKeys(start, now, granularity)),
    previousTrend:
      previous && prior
        ? fillTrendBuckets(
            prior,
            trendBucketKeys(
              previous.start,
              new Date(previous.end.getTime() - 1),
              granularity,
            ),
          )
        : undefined,
  };
}

/** Top event names in the window, with their counts in the preceding window. */
export async function getOverviewTopEvents(
  db: Database,
  projectFilter: ProjectFilter,
  input: { rangeStart?: Date; previousStart?: Date; limit?: number },
) {
  const scoped = (where: SQL | undefined) =>
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
      .where(where)
      .groupBy(analyticsEvents.name);
  const top = await scoped(
    and(
      projectFilter,
      input.rangeStart
        ? gte(analyticsEvents.occurredAt, input.rangeStart)
        : undefined,
    ),
  )
    .orderBy(desc(sql`count(*)`))
    .limit(input.limit ?? 5);
  if (!input.rangeStart || !input.previousStart || top.length === 0) return top;
  const prior = await scoped(
    and(
      projectFilter,
      inArray(
        analyticsEvents.name,
        top.map((event) => event.name),
      ),
      gte(analyticsEvents.occurredAt, input.previousStart),
      lt(analyticsEvents.occurredAt, input.rangeStart),
    ),
  );
  const priorCounts = new Map(prior.map((event) => [event.name, event.count]));
  return top.map((event) => ({
    ...event,
    previousCount: priorCounts.get(event.name) ?? 0,
  }));
}
