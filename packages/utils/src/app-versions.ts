import type {
  AnalyticsEventRow,
  AnalyticsOverviewRange,
  AnalyticsTrendGranularity,
} from "./index";
import { pagesReportWindow } from "./pages";

/** Versions shown individually in the chart, table and platform breakdown. */
export const APP_VERSIONS_TOP_N = 8;
/** How far back "first seen" looks, and how long a quiet app still counts as mobile. */
export const APP_VERSIONS_LOOKBACK_DAYS = 90;

export type AppVersionSeriesKind = "version" | "other" | "unknown";
export type AppVersionPlatform = "ios" | "android" | "unknown";

/**
 * Raw aggregate rows. The SQL query and the in-memory summarizer both produce
 * these, and `buildAppVersionsReport` turns them into the report, so the
 * grouping rules live in one place.
 */
export type AppVersionUserRow = {
  /** Platform, version and build of each visitor's latest mobile event in the range. */
  platform: string | null;
  version: string | null;
  build: string | null;
  users: number;
};
export type AppVersionActivityRow = {
  version: string | null;
  /** Mobile events on this version in the range (including events without a visitor). */
  events: number;
  /** Distinct visitors with any event on this version in the range. */
  users: number;
  /** Earliest event on this version within the lookback. */
  firstSeen: string;
  /** Latest event on this version in the range; null when only seen before the range. */
  lastSeen: string | null;
};
export type AppVersionTrendRow = {
  bucket: string;
  version: string | null;
  /** Visitors whose latest event in this bucket was on this version. */
  users: number;
};

export type AppVersionSeries = {
  /** Stable chart key: `v0`…, `other` or `unknown` (version strings contain dots). */
  key: string;
  label: string;
  kind: AppVersionSeriesKind;
  version: string | null;
};

export type AppVersionRow = AppVersionSeries & {
  /**
   * Distinct visitors with any event on this version in the range. A visitor
   * who upgraded counts under both versions, so shares can sum past 100%.
   * Null for the `other` row, whose members' visitors cannot be de-duplicated
   * from per-version counts.
   */
  activeUsers: number | null;
  /** activeUsers / all active users in the range, 0–1. */
  activeShare: number | null;
  /** Visitors whose latest event in the range was on this version ("still on it"). Sums to all active users. */
  currentUsers: number;
  currentShare: number;
  events: number;
  firstSeen: string | null;
  lastSeen: string | null;
  /** Number of versions folded into the `other` row; 1 otherwise. */
  versionCount: number;
  builds: Array<{ build: string | null; users: number }>;
  platforms: Record<AppVersionPlatform, number>;
  /** Semantically newest known version seen in the range. */
  latest: boolean;
};

export type AnalyticsAppVersionsReport = {
  range: AnalyticsOverviewRange;
  start: string;
  end: string;
  granularity: AnalyticsTrendGranularity;
  lookbackDays: number;
  /** False when the project sent no mobile events in the lookback: a web-only project. */
  mobile: boolean;
  totals: {
    /** Distinct visitors with a mobile event in the range. */
    activeUsers: number;
    events: number;
    unknownUsers: number;
    /** Distinct known versions seen in the range. */
    versions: number;
  };
  latestVersion: string | null;
  series: AppVersionSeries[];
  /** Newest first, then `other`, then `unknown`. */
  versions: AppVersionRow[];
  trend: Array<{
    bucket: string;
    total: number;
    values: Record<string, number>;
  }>;
  platforms: Array<{
    platform: AppVersionPlatform;
    users: number;
    versions: Array<AppVersionSeries & { users: number; share: number }>;
  }>;
};

export function normalizeAppVersion(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function platformOf(value: string | null | undefined): AppVersionPlatform {
  return value === "ios" || value === "android" ? value : "unknown";
}

type ParsedVersion = { core: string[]; pre: string[] | null };

function parseVersion(value: string): ParsedVersion {
  const withoutBuild =
    value
      .trim()
      .replace(/^v(?=\d)/i, "")
      .split("+")[0] ?? "";
  const dash = withoutBuild.indexOf("-");
  const core = dash === -1 ? withoutBuild : withoutBuild.slice(0, dash);
  const pre = dash === -1 ? null : withoutBuild.slice(dash + 1);
  return { core: core.split("."), pre: pre ? pre.split(".") : null };
}

function compareIdentifier(a: string, b: string) {
  const numA = /^\d+$/.test(a);
  const numB = /^\d+$/.test(b);
  if (numA && numB) return Number(a) - Number(b);
  if (numA !== numB) return numA ? -1 : 1;
  return a.localeCompare(b, "en", { numeric: true });
}

/**
 * Semantic version order (ascending): `1.9.0 < 1.10.0`, `1.2 = 1.2.0`,
 * `1.0.0-beta < 1.0.0`, build metadata after `+` ignored. Non-numeric parts
 * compare naturally, so arbitrary version strings still sort sensibly.
 */
export function compareAppVersions(a: string, b: string): number {
  const left = parseVersion(a);
  const right = parseVersion(b);
  const length = Math.max(left.core.length, right.core.length);
  for (let index = 0; index < length; index += 1) {
    const order = compareIdentifier(
      left.core[index] ?? "0",
      right.core[index] ?? "0",
    );
    if (order !== 0) return Math.sign(order);
  }
  if (!left.pre || !right.pre) {
    if (left.pre) return -1;
    if (right.pre) return 1;
    return Math.sign(a.localeCompare(b));
  }
  const preLength = Math.max(left.pre.length, right.pre.length);
  for (let index = 0; index < preLength; index += 1) {
    const l = left.pre[index];
    const r = right.pre[index];
    if (l === undefined) return -1;
    if (r === undefined) return 1;
    const order = compareIdentifier(l, r);
    if (order !== 0) return Math.sign(order);
  }
  return Math.sign(a.localeCompare(b));
}

/** 24h reads hourly buckets; 7d and 30d read UTC days (as Pulse). */
export function appVersionsGranularity(
  range: AnalyticsOverviewRange,
): AnalyticsTrendGranularity {
  return range === "24h" ? "hour" : "day";
}

export function appVersionsWindow(range: AnalyticsOverviewRange, now: Date) {
  const { start, end } = pagesReportWindow(range, now);
  return {
    start,
    end,
    lookbackStart: new Date(
      end.getTime() - APP_VERSIONS_LOOKBACK_DAYS * 86_400_000,
    ),
  };
}

function truncateBucket(date: Date, granularity: AnalyticsTrendGranularity) {
  const copy = new Date(date);
  copy.setUTCMinutes(0, 0, 0);
  if (granularity === "day") copy.setUTCHours(0);
  return copy;
}

/** Every bucket key (ISO, UTC-truncated) from the range start's bucket through the end's. */
export function appVersionsBuckets(
  start: Date,
  end: Date,
  granularity: AnalyticsTrendGranularity,
) {
  const step = granularity === "hour" ? 3_600_000 : 86_400_000;
  const buckets: string[] = [];
  const last = truncateBucket(new Date(end.getTime() - 1), granularity);
  for (
    let at = truncateBucket(start, granularity).getTime();
    at <= last.getTime();
    at += step
  ) {
    buckets.push(new Date(at).toISOString());
  }
  return buckets;
}

const OTHER: AppVersionSeries = {
  key: "other",
  label: "Other",
  kind: "other",
  version: null,
};
const UNKNOWN: AppVersionSeries = {
  key: "unknown",
  label: "Unknown",
  kind: "unknown",
  version: null,
};

export function buildAppVersionsReport(input: {
  range: AnalyticsOverviewRange;
  start: Date;
  end: Date;
  userRows: AppVersionUserRow[];
  activityRows: AppVersionActivityRow[];
  trendRows: AppVersionTrendRow[];
}): AnalyticsAppVersionsReport {
  const granularity = appVersionsGranularity(input.range);
  const userRows = input.userRows.map((row) => ({
    ...row,
    version: normalizeAppVersion(row.version),
    build: normalizeAppVersion(row.build),
  }));
  const activity = new Map<string | null, AppVersionActivityRow>();
  for (const row of input.activityRows) {
    const version = normalizeAppVersion(row.version);
    const existing = activity.get(version);
    activity.set(
      version,
      existing
        ? {
            version,
            events: existing.events + row.events,
            users: existing.users + row.users,
            firstSeen:
              existing.firstSeen < row.firstSeen
                ? existing.firstSeen
                : row.firstSeen,
            lastSeen:
              [existing.lastSeen, row.lastSeen]
                .filter((value): value is string => value !== null)
                .sort()
                .at(-1) ?? null,
          }
        : { ...row, version },
    );
  }

  const usersByVersion = new Map<string | null, number>();
  for (const row of userRows) {
    usersByVersion.set(
      row.version,
      (usersByVersion.get(row.version) ?? 0) + row.users,
    );
  }
  const inRange = new Set<string | null>(usersByVersion.keys());
  for (const row of activity.values()) {
    if (row.lastSeen !== null) inRange.add(row.version);
  }
  const known = [...inRange].filter(
    (version): version is string => version !== null,
  );
  const newestFirst = (a: string, b: string) => compareAppVersions(b, a);
  // Rank by user-buckets (users summed over chart buckets), so a version that
  // dominated earlier in the range keeps its own series after users upgrade.
  const weight = new Map<string | null, number>();
  for (const row of input.trendRows) {
    const version = normalizeAppVersion(row.version);
    weight.set(version, (weight.get(version) ?? 0) + row.users);
  }
  const top = new Set(
    [...known]
      .sort(
        (a, b) =>
          (weight.get(b) ?? 0) - (weight.get(a) ?? 0) ||
          (activity.get(b)?.users ?? 0) - (activity.get(a)?.users ?? 0) ||
          (activity.get(b)?.events ?? 0) - (activity.get(a)?.events ?? 0) ||
          newestFirst(a, b),
      )
      .slice(0, APP_VERSIONS_TOP_N),
  );
  const topSeries: AppVersionSeries[] = [...top]
    .sort(newestFirst)
    .map((version, index) => ({
      key: `v${index}`,
      label: version,
      kind: "version",
      version,
    }));
  const seriesFor = new Map<string | null, AppVersionSeries>(
    topSeries.map((series) => [series.version, series]),
  );
  const resolve = (version: string | null) =>
    version === null ? UNKNOWN : (seriesFor.get(version) ?? OTHER);
  const hasOther = known.some((version) => !top.has(version));
  const series = [
    ...topSeries,
    ...(hasOther ? [OTHER] : []),
    ...(inRange.has(null) ? [UNKNOWN] : []),
  ];

  const activeUsers = userRows.reduce((sum, row) => sum + row.users, 0);
  const share = (users: number) => (activeUsers ? users / activeUsers : 0);
  const latestVersion = [...known].sort(newestFirst)[0] ?? null;

  const versions: AppVersionRow[] = series.map((entry) => {
    const members = [...inRange].filter(
      (version) => resolve(version).key === entry.key,
    );
    const rows = userRows.filter(
      (row) => resolve(row.version).key === entry.key,
    );
    const users = rows.reduce((sum, row) => sum + row.users, 0);
    const builds = new Map<string | null, number>();
    const platforms: Record<AppVersionPlatform, number> = {
      ios: 0,
      android: 0,
      unknown: 0,
    };
    for (const row of rows) {
      builds.set(row.build, (builds.get(row.build) ?? 0) + row.users);
      platforms[platformOf(row.platform)] += row.users;
    }
    const memberActivity = members.flatMap((version) => {
      const row = activity.get(version);
      return row ? [row] : [];
    });
    const firstSeen =
      memberActivity
        .map((row) => row.firstSeen)
        .sort()
        .at(0) ?? null;
    const lastSeen =
      memberActivity
        .flatMap((row) => (row.lastSeen ? [row.lastSeen] : []))
        .sort()
        .at(-1) ?? null;
    return {
      ...entry,
      activeUsers:
        entry.kind === "other"
          ? null
          : memberActivity.reduce((sum, row) => sum + row.users, 0),
      activeShare:
        entry.kind === "other"
          ? null
          : share(memberActivity.reduce((sum, row) => sum + row.users, 0)),
      currentUsers: users,
      currentShare: share(users),
      events: memberActivity.reduce((sum, row) => sum + row.events, 0),
      firstSeen,
      lastSeen,
      versionCount: members.length,
      builds: [...builds.entries()]
        .map(([build, count]) => ({ build, users: count }))
        .sort(
          (a, b) =>
            b.users - a.users ||
            (a.build === null ? 1 : b.build === null ? -1 : 0) ||
            compareAppVersions(String(b.build), String(a.build)),
        ),
      platforms,
      latest: entry.kind === "version" && entry.version === latestVersion,
    };
  });

  const trendByBucket = new Map<string, Record<string, number>>();
  for (const row of input.trendRows) {
    const bucket = new Date(row.bucket).toISOString();
    const values = trendByBucket.get(bucket) ?? {};
    const key = resolve(normalizeAppVersion(row.version)).key;
    values[key] = (values[key] ?? 0) + row.users;
    trendByBucket.set(bucket, values);
  }
  const trend = appVersionsBuckets(input.start, input.end, granularity).map(
    (bucket) => {
      const found = trendByBucket.get(bucket) ?? {};
      const values = Object.fromEntries(
        series.map((entry) => [entry.key, found[entry.key] ?? 0]),
      );
      return {
        bucket,
        total: Object.values(values).reduce((sum, value) => sum + value, 0),
        values,
      };
    },
  );

  const platforms = (["ios", "android", "unknown"] as const).flatMap(
    (platform) => {
      const rows = userRows.filter(
        (row) => platformOf(row.platform) === platform,
      );
      const users = rows.reduce((sum, row) => sum + row.users, 0);
      if (!users) return [];
      return [
        {
          platform,
          users,
          versions: series.flatMap((entry) => {
            const count = rows
              .filter((row) => resolve(row.version).key === entry.key)
              .reduce((sum, row) => sum + row.users, 0);
            return count
              ? [{ ...entry, users: count, share: count / users }]
              : [];
          }),
        },
      ];
    },
  );

  return {
    range: input.range,
    start: input.start.toISOString(),
    end: input.end.toISOString(),
    granularity,
    lookbackDays: APP_VERSIONS_LOOKBACK_DAYS,
    mobile: activity.size > 0 || activeUsers > 0,
    totals: {
      activeUsers,
      events: [...activity.values()].reduce((sum, row) => sum + row.events, 0),
      unknownUsers: usersByVersion.get(null) ?? 0,
      versions: known.length,
    },
    latestVersion,
    series,
    versions,
    trend,
    platforms,
  };
}

/**
 * In-memory report with the same rules as the SQL query: mobile events only,
 * each visitor attributed to the version of their latest event in the range
 * (and in each bucket), so shares sum to 100%. Used for demo mode and as the
 * executable specification in tests.
 */
export function summarizeAppVersions(
  events: AnalyticsEventRow[],
  input: { project: string; range: AnalyticsOverviewRange; now?: Date },
): AnalyticsAppVersionsReport {
  const window = appVersionsWindow(input.range, input.now ?? new Date());
  const granularity = appVersionsGranularity(input.range);
  const at = (event: AnalyticsEventRow) => new Date(event.occurredAt).getTime();
  const mobile = events
    .filter(
      (event) =>
        event.project === input.project &&
        event.source === "mobile" &&
        at(event) >= window.lookbackStart.getTime() &&
        at(event) < window.end.getTime(),
    )
    .sort((a, b) => at(a) - at(b) || a.id.localeCompare(b.id));
  const current = mobile.filter((event) => at(event) >= window.start.getTime());

  const latest = new Map<string, AnalyticsEventRow>();
  for (const event of current) {
    if (event.visitorKey) latest.set(event.visitorKey, event);
  }
  const userCounts = new Map<string, AppVersionUserRow>();
  for (const event of latest.values()) {
    const row = {
      platform: event.platform ?? null,
      version: normalizeAppVersion(event.appVersion),
      build: normalizeAppVersion(event.appBuild),
    };
    const key = JSON.stringify(row);
    const existing = userCounts.get(key) ?? { ...row, users: 0 };
    existing.users += 1;
    userCounts.set(key, existing);
  }

  const activityRows = new Map<string | null, AppVersionActivityRow>();
  const activityVisitors = new Map<string | null, Set<string>>();
  for (const event of mobile) {
    const version = normalizeAppVersion(event.appVersion);
    const row = activityRows.get(version) ?? {
      version,
      events: 0,
      users: 0,
      firstSeen: new Date(event.occurredAt).toISOString(),
      lastSeen: null,
    };
    if (at(event) >= window.start.getTime()) {
      row.events += 1;
      if (event.visitorKey) {
        const seen = activityVisitors.get(version) ?? new Set<string>();
        seen.add(event.visitorKey);
        activityVisitors.set(version, seen);
        row.users = seen.size;
      }
      row.lastSeen = new Date(event.occurredAt).toISOString();
    }
    activityRows.set(version, row);
  }

  const bucketLatest = new Map<string, AnalyticsEventRow>();
  for (const event of current) {
    if (!event.visitorKey) continue;
    const bucket = truncateBucket(
      new Date(event.occurredAt),
      granularity,
    ).toISOString();
    bucketLatest.set(`${bucket}|${event.visitorKey}`, event);
  }
  const trendCounts = new Map<string, AppVersionTrendRow>();
  for (const [key, event] of bucketLatest) {
    const bucket = key.split("|")[0] ?? "";
    const version = normalizeAppVersion(event.appVersion);
    const id = `${bucket}|${version}`;
    const row = trendCounts.get(id) ?? { bucket, version, users: 0 };
    row.users += 1;
    trendCounts.set(id, row);
  }

  return buildAppVersionsReport({
    range: input.range,
    start: window.start,
    end: window.end,
    userRows: [...userCounts.values()],
    activityRows: [...activityRows.values()],
    trendRows: [...trendCounts.values()],
  });
}
