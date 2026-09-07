import type { AnalyticsEventRow } from "./index";

export type AnalyticsFunnelQuery = {
  project: string;
  organization?: string;
  steps: string[];
  start?: string;
  end?: string;
};
export type AnalyticsFunnel = {
  steps: Array<{
    name: string;
    visitors: number;
    conversion: number;
    dropOff: number;
  }>;
  start: string;
  end: string;
};

export function normalizeFunnelQuery(
  query: AnalyticsFunnelQuery,
  now = new Date(),
) {
  if (!/^[a-z0-9-]{2,64}$/.test(query.project))
    throw new Error("A valid project is required");
  if (
    query.steps.length < 2 ||
    query.steps.length > 5 ||
    query.steps.some((name) => !/^[a-z][a-z0-9_.]{0,79}$/.test(name))
  )
    throw new Error("Choose two to five valid event names");
  const end = query.end ? new Date(query.end) : now;
  const start = query.start
    ? new Date(query.start)
    : new Date(end.getTime() - 30 * 86_400_000);
  if (
    !Number.isFinite(start.getTime()) ||
    !Number.isFinite(end.getTime()) ||
    start >= end ||
    end.getTime() - start.getTime() > 90 * 86_400_000
  )
    throw new Error("Choose an ordered date range of at most 90 days");
  return { ...query, start: start.toISOString(), end: end.toISOString() };
}

export function formatFunnelCounts(
  query: ReturnType<typeof normalizeFunnelQuery>,
  counts: number[],
): AnalyticsFunnel {
  return {
    start: query.start,
    end: query.end,
    steps: query.steps.map((name, index) => {
      const visitors = counts[index] ?? 0;
      const previous = counts[index - 1] ?? visitors;
      return {
        name,
        visitors,
        conversion: counts[0]
          ? Math.round((visitors / counts[0]) * 1000) / 10
          : 0,
        dropOff: previous - visitors,
      };
    }),
  };
}

export function summarizeFunnel(
  events: AnalyticsEventRow[],
  input: AnalyticsFunnelQuery,
): AnalyticsFunnel {
  const query = normalizeFunnelQuery(input);
  const buckets = new Map<string, AnalyticsEventRow[]>();
  for (const event of events) {
    if (
      event.project !== query.project ||
      event.source !== "browser" ||
      !event.visitorKey ||
      !query.steps.includes(event.name)
    )
      continue;
    const time = new Date(event.occurredAt).toISOString();
    if (time < query.start || time > query.end) continue;
    const key = `${event.visitorKey}:${time.slice(0, 10)}`;
    const bucket = buckets.get(key) ?? [];
    bucket.push(event);
    buckets.set(key, bucket);
  }
  const counts = query.steps.map(() => 0);
  for (const bucket of buckets.values()) {
    bucket.sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));
    let after = -Infinity;
    for (const [index, name] of query.steps.entries()) {
      const event = bucket.find(
        (row) => row.name === name && Date.parse(row.occurredAt) > after,
      );
      if (!event) break;
      after = Date.parse(event.occurredAt);
      counts[index] = (counts[index] ?? 0) + 1;
    }
  }
  return formatFunnelCounts(query, counts);
}
