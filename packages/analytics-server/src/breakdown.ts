// Request/response types for GET /v1/dashboard/breakdown. Kept local so the
// published server package does not depend on private workspace packages.

export type LoglyBreakdownDimension =
  | "name"
  | "source"
  | "platform"
  | `property:${string}`;
export type LoglyBreakdownMetric = "events" | "actors" | "groups";

export type LoglyBreakdownQuery = {
  project: string;
  organization?: string;
  /** Inclusive ISO 8601 timestamp with a time zone. */
  start: string;
  /** Exclusive ISO 8601 timestamp with a time zone; window ≤ 366 days. */
  end: string;
  /** One or two dimensions. */
  by: LoglyBreakdownDimension[];
  /** Defaults to ["events"]. */
  metrics?: LoglyBreakdownMetric[];
  /** Group type counted by the `groups` metric. Defaults to "business". */
  metricGroupType?: string;
  interval?: "day";
  /** Top values kept per dimension (1–20, default 10); the rest become "(other)". */
  limit?: number;
  /** Numeric property summarised as p50/p95 per bucket. */
  durationProperty?: string;
  names?: string[];
  sources?: Array<"browser" | "server" | "mobile">;
  platforms?: Array<"web" | "ios" | "android">;
  /** Hashed actor reference (64 hex characters). */
  actor?: string;
  groupType?: string;
  groupKey?: string;
  propertyKey?: string;
  propertyValue?: string | number | boolean | null;
};

export type LoglyBreakdownValues = {
  events?: number;
  actors?: number;
  groups?: number;
  duration?: { p50: number | null; p95: number | null; samples: number };
};
export type LoglyBreakdownBucket = LoglyBreakdownValues & {
  dimensions: Record<string, string>;
};
export type LoglyBreakdownResult = {
  project: string;
  start: string;
  end: string;
  by: LoglyBreakdownDimension[];
  metrics: LoglyBreakdownMetric[];
  metricGroupType: string | null;
  interval: "day" | null;
  limit: number;
  durationProperty: string | null;
  totals: LoglyBreakdownValues;
  buckets: LoglyBreakdownBucket[];
  series?: Array<{
    date: string;
    totals: LoglyBreakdownValues;
    buckets: LoglyBreakdownBucket[];
  }>;
};

export function breakdownSearchParams(query: LoglyBreakdownQuery) {
  const params = new URLSearchParams();
  const set = (key: string, value: string | number | undefined) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  };
  const join = (values?: readonly string[]) =>
    values?.length ? values.join(",") : undefined;
  set("project", query.project);
  set("organization", query.organization);
  set("start", query.start);
  set("end", query.end);
  set("by", join(query.by));
  set("metrics", join(query.metrics));
  set("metricGroupType", query.metricGroupType);
  set("interval", query.interval);
  set("limit", query.limit);
  set("durationProperty", query.durationProperty);
  set("names", join(query.names));
  set("sources", join(query.sources));
  set("platforms", join(query.platforms));
  set("actor", query.actor);
  set("groupType", query.groupType);
  set("groupKey", query.groupKey);
  if (query.propertyKey !== undefined) {
    set("propertyKey", query.propertyKey);
    params.set("propertyValue", JSON.stringify(query.propertyValue ?? null));
  }
  return params;
}
