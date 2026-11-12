// Breakdown read contract shared by the collector route and the SQL query.
// Parsing is strict: any malformed input is rejected rather than ignored so a
// caller never receives a silently broadened (or narrowed) aggregate.

export const BREAKDOWN_MAX_LIMIT = 20;
export const BREAKDOWN_DEFAULT_LIMIT = 10;
export const BREAKDOWN_MAX_WINDOW_DAYS = 366;
export const BREAKDOWN_MAX_SERIES_CELLS = 50_000;
export const BREAKDOWN_NONE = "(none)";
export const BREAKDOWN_OTHER = "(other)";

export type BreakdownDimension =
  | "name"
  | "source"
  | "platform"
  | `property:${string}`;
export type BreakdownMetric = "events" | "actors" | "groups";
export type BreakdownScalar = string | number | boolean | null;

export type BreakdownQuery = {
  project: string;
  organization?: string;
  start: string;
  end: string;
  names?: string[];
  sources?: Array<"browser" | "server" | "mobile">;
  platforms?: Array<"web" | "ios" | "android">;
  actor?: string;
  groupType?: string;
  groupKey?: string;
  propertyKey?: string;
  propertyValue?: BreakdownScalar;
  by: BreakdownDimension[];
  metrics: BreakdownMetric[];
  metricGroupType: string;
  interval?: "day";
  limit: number;
  durationProperty?: string;
};

export type BreakdownDuration = {
  p50: number | null;
  p95: number | null;
  samples: number;
};
export type BreakdownValues = {
  events?: number;
  actors?: number;
  groups?: number;
  duration?: BreakdownDuration;
};
export type BreakdownBucket = BreakdownValues & {
  dimensions: Record<string, string>;
};
export type BreakdownSeriesPoint = {
  date: string;
  totals: BreakdownValues;
  buckets: BreakdownBucket[];
};
export type BreakdownResult = {
  project: string;
  start: string;
  end: string;
  by: BreakdownDimension[];
  metrics: BreakdownMetric[];
  metricGroupType: string | null;
  interval: "day" | null;
  limit: number;
  durationProperty: string | null;
  totals: BreakdownValues;
  buckets: BreakdownBucket[];
  series?: BreakdownSeriesPoint[];
};

export class BreakdownQueryError extends Error {}

const SNAKE_KEY = /^[a-z][a-z0-9_]{0,63}$/;
const SLUG = /^[a-z0-9][a-z0-9-]{0,127}$/;
const DAY_MS = 86_400_000;

function fail(message: string): never {
  throw new BreakdownQueryError(message);
}

function list(value: string | null, label: string, max = 50) {
  if (value === null || value === "") return undefined;
  const items = value.split(",").map((item) => item.trim());
  if (items.some((item) => !item || item.length > 128))
    fail(`Invalid ${label}`);
  if (items.length > max) fail(`Too many ${label}`);
  return [...new Set(items)];
}

function timestamp(value: string | null, label: string) {
  if (!value) fail(`${label} is required`);
  // Require an explicit ISO date-time so server time zones never shift windows.
  if (!/^\d{4}-\d{2}-\d{2}T[\d:.]+(Z|[+-]\d{2}:\d{2})$/.test(value))
    fail(`${label} must be an ISO 8601 timestamp with a time zone`);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) fail(`${label} is not a valid timestamp`);
  return date;
}

function scalar(value: string): BreakdownScalar {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    fail("propertyValue must be a JSON scalar");
  }
  if (
    parsed === null ||
    typeof parsed === "boolean" ||
    (typeof parsed === "string" && parsed.length <= 256) ||
    (typeof parsed === "number" && Number.isFinite(parsed))
  )
    return parsed;
  fail("propertyValue must be a bounded JSON scalar");
}

function dimension(value: string): BreakdownDimension {
  if (value === "name" || value === "source" || value === "platform")
    return value;
  if (value.startsWith("property:")) {
    const key = value.slice("property:".length);
    if (SNAKE_KEY.test(key)) return `property:${key}`;
  }
  fail(`Invalid breakdown dimension: ${value.slice(0, 80)}`);
}

export function breakdownDays(start: Date, end: Date) {
  const first = Date.UTC(
    start.getUTCFullYear(),
    start.getUTCMonth(),
    start.getUTCDate(),
  );
  const days: string[] = [];
  for (let day = first; day < end.getTime(); day += DAY_MS)
    days.push(new Date(day).toISOString().slice(0, 10));
  return days;
}

export function parseBreakdownQuery(params: {
  get: (key: string) => string | null;
}): BreakdownQuery {
  const project = params.get("project");
  if (!project) fail("Project is required");
  if (!SLUG.test(project)) fail("Invalid project");
  const organization = params.get("organization") || undefined;
  if (organization && !SLUG.test(organization)) fail("Invalid organization");

  const start = timestamp(params.get("start"), "start");
  const end = timestamp(params.get("end"), "end");
  if (end <= start) fail("end must be after start");
  if (end.getTime() - start.getTime() > BREAKDOWN_MAX_WINDOW_DAYS * DAY_MS)
    fail(`Window may not exceed ${BREAKDOWN_MAX_WINDOW_DAYS} days`);

  const by = list(params.get("by"), "breakdown dimensions", 2)?.map(dimension);
  if (!by?.length) fail("by requires one or two dimensions");

  const metrics = (list(params.get("metrics"), "metrics", 3) ?? ["events"]).map(
    (metric) => {
      if (metric === "events" || metric === "actors" || metric === "groups")
        return metric;
      return fail(`Invalid metric: ${metric.slice(0, 40)}`);
    },
  );

  const metricGroupType = params.get("metricGroupType") || "business";
  if (!SNAKE_KEY.test(metricGroupType)) fail("Invalid metricGroupType");

  const interval = params.get("interval") || undefined;
  if (interval !== undefined && interval !== "day")
    fail("interval must be day");

  const limitParam = params.get("limit");
  const limit =
    limitParam === null || limitParam === ""
      ? BREAKDOWN_DEFAULT_LIMIT
      : Number(limitParam);
  if (!Number.isInteger(limit) || limit < 1 || limit > BREAKDOWN_MAX_LIMIT)
    fail(`limit must be an integer from 1 to ${BREAKDOWN_MAX_LIMIT}`);

  const durationProperty = params.get("durationProperty") || undefined;
  if (durationProperty && !SNAKE_KEY.test(durationProperty))
    fail("Invalid durationProperty");

  const sources = list(params.get("sources"), "sources", 3)?.map((source) => {
    if (source === "browser" || source === "server" || source === "mobile")
      return source;
    return fail(`Invalid source: ${source.slice(0, 40)}`);
  });
  const platforms = list(params.get("platforms"), "platforms", 3)?.map(
    (platform) => {
      if (platform === "web" || platform === "ios" || platform === "android")
        return platform;
      return fail(`Invalid platform: ${platform.slice(0, 40)}`);
    },
  );

  const actor = params.get("actor") || undefined;
  if (actor && !/^[a-f0-9]{64}$/.test(actor)) fail("Invalid event actor");

  const groupType = params.get("groupType") || undefined;
  const groupKey = params.get("groupKey") || undefined;
  if (groupType && !SNAKE_KEY.test(groupType)) fail("Invalid groupType");
  if (groupKey && (!groupType || groupKey.length > 128))
    fail("groupKey requires a groupType");

  const propertyKey = params.get("propertyKey") || undefined;
  const rawPropertyValue = params.get("propertyValue");
  const hasPropertyValue = rawPropertyValue !== null && rawPropertyValue !== "";
  if (Boolean(propertyKey) !== hasPropertyValue)
    fail("propertyKey and propertyValue are required together");
  if (propertyKey && propertyKey.length > 64) fail("Invalid propertyKey");

  if (interval === "day") {
    const cells = breakdownDays(start, end).length * (limit + 2) ** by.length;
    if (cells > BREAKDOWN_MAX_SERIES_CELLS)
      fail(
        "Daily series is too large; shorten the window, lower limit or use one dimension",
      );
  }

  return {
    project,
    organization,
    start: start.toISOString(),
    end: end.toISOString(),
    names: list(params.get("names"), "names"),
    sources,
    platforms,
    actor,
    groupType,
    groupKey,
    propertyKey,
    propertyValue: hasPropertyValue ? scalar(rawPropertyValue) : undefined,
    by,
    metrics: [...new Set(metrics)],
    metricGroupType,
    interval,
    limit,
    durationProperty,
  };
}
