import type { AnalyticsEventRow } from "./index";

/**
 * Retention: how many users come back after their first visit.
 *
 * A user is the per-project `visitorKey`. Cohort entry is a visitor's first
 * `site_visit` (web) or `app_session` (mobile) within the lookback; any later
 * event (or one chosen event) in a later period counts as returning. A
 * visitor key is per device/browser and resets when storage is cleared, so
 * every rate here is a lower bound.
 */

export const RETENTION_RANGES = ["7d", "30d", "12w"] as const;
export type RetentionRange = (typeof RETENTION_RANGES)[number];
export type RetentionGranularity = "day" | "week";
export const RETENTION_SURFACES = ["all", "web", "mobile"] as const;
export type RetentionSurface = (typeof RETENTION_SURFACES)[number];

/** Weekly cohorts are capped at 12; daily cohorts at 7. */
export const RETENTION_MAX_COHORTS = 12;
/**
 * A visitor whose entry event appears in this many days before the first
 * cohort is not new, so it joins no cohort. Older visitors outside the
 * lookback can still be counted as new (another reason rates are a floor).
 */
export const RETENTION_LOOKBACK_DAYS = 90;
export const RETENTION_RETURN_EVENT_MAX_LENGTH = 120;

const DAY_MS = 86_400_000;

const rangeConfig: Record<
  RetentionRange,
  { granularity: RetentionGranularity; cohorts: number }
> = {
  "7d": { granularity: "day", cohorts: 7 },
  "30d": { granularity: "week", cohorts: 5 },
  "12w": { granularity: "week", cohorts: RETENTION_MAX_COHORTS },
};

export function isRetentionRange(value: unknown): value is RetentionRange {
  return RETENTION_RANGES.includes(value as RetentionRange);
}

export function isRetentionSurface(value: unknown): value is RetentionSurface {
  return RETENTION_SURFACES.includes(value as RetentionSurface);
}

/** Entry event names for a surface: web `site_visit`, mobile `app_session`. */
export function retentionEntryEvents(surface: RetentionSurface) {
  if (surface === "web") return ["site_visit"];
  if (surface === "mobile") return ["app_session"];
  return ["site_visit", "app_session"];
}

/** Whether an event belongs to the surface (web is every non-mobile source). */
export function matchesRetentionSurface(
  source: string,
  surface: RetentionSurface,
) {
  if (surface === "all") return true;
  return surface === "mobile" ? source === "mobile" : source !== "mobile";
}

/** The returning-event filter: blank means any event. */
export function normalizeRetentionReturnEvent(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > RETENTION_RETURN_EVENT_MAX_LENGTH)
    return null;
  return trimmed;
}

export function retentionStepMs(granularity: RetentionGranularity) {
  return granularity === "day" ? DAY_MS : 7 * DAY_MS;
}

/** UTC day, or ISO week starting Monday 00:00 UTC (as Postgres `date_trunc('week')`). */
export function truncateRetentionPeriod(
  date: Date,
  granularity: RetentionGranularity,
) {
  const copy = new Date(date);
  copy.setUTCHours(0, 0, 0, 0);
  if (granularity === "week") {
    const sinceMonday = (copy.getUTCDay() + 6) % 7;
    copy.setUTCDate(copy.getUTCDate() - sinceMonday);
  }
  return copy;
}

/**
 * Cohorts run from the first cohort's period start through now; the newest
 * cohort is the current (incomplete) day or week.
 */
export function retentionWindow(range: RetentionRange, now: Date) {
  const { granularity, cohorts } = rangeConfig[range];
  const step = retentionStepMs(granularity);
  const current = truncateRetentionPeriod(now, granularity);
  const start = new Date(current.getTime() - (cohorts - 1) * step);
  return {
    granularity,
    cohorts,
    periods: cohorts,
    start,
    end: now,
    lookbackStart: new Date(start.getTime() - RETENTION_LOOKBACK_DAYS * DAY_MS),
  };
}

/**
 * Raw aggregate rows. The SQL query and the in-memory summarizer both produce
 * these; `buildRetentionReport` turns them into the report.
 */
export type RetentionCohortRow = {
  /** Cohort period start, ISO UTC. */
  cohort: string;
  users: number;
};
export type RetentionActivityRow = {
  cohort: string;
  /** Periods after the cohort period (1 = the next day or week). */
  period: number;
  /** Distinct cohort visitors with a returning event in that period. */
  users: number;
};

export type RetentionCellStatus = "complete" | "partial";
export type RetentionCell = {
  period: number;
  users: number;
  /** users / cohort size; 0 when the cohort is empty. */
  rate: number;
  /** `partial`: the period has not ended yet, so the value can still grow. */
  status: RetentionCellStatus;
};
export type RetentionCohort = {
  start: string;
  size: number;
  /** False while the cohort's own day or week is still running. */
  complete: boolean;
  /** One entry per period column; null for periods that have not started. */
  cells: Array<RetentionCell | null>;
};
export type RetentionAveragePoint = {
  period: number;
  /** Size-weighted rate over cohorts whose period has ended; null if none has. */
  rate: number | null;
  users: number;
  cohortUsers: number;
  /** Cohorts that contributed (complete for this period, size > 0). */
  cohorts: number;
};

export type AnalyticsRetentionReport = {
  range: RetentionRange;
  granularity: RetentionGranularity;
  surface: RetentionSurface;
  /** The returning event; null means any event. */
  returnEvent: string | null;
  start: string;
  end: string;
  /** Number of period columns (0 .. periods - 1). */
  periods: number;
  lookbackDays: number;
  /** Which entry events the project sent within the lookback. */
  surfaces: { web: boolean; mobile: boolean };
  /** Oldest cohort first. */
  cohorts: RetentionCohort[];
  average: RetentionAveragePoint[];
  totals: { users: number };
};

export function buildRetentionReport(input: {
  range: RetentionRange;
  surface: RetentionSurface;
  returnEvent: string | null;
  now: Date;
  surfaces: { web: boolean; mobile: boolean };
  cohortRows: RetentionCohortRow[];
  activityRows: RetentionActivityRow[];
}): AnalyticsRetentionReport {
  const window = retentionWindow(input.range, input.now);
  const step = retentionStepMs(window.granularity);
  const nowMs = input.now.getTime();
  const iso = (value: string) => new Date(value).toISOString();
  const sizes = new Map(
    input.cohortRows.map((row) => [iso(row.cohort), row.users]),
  );
  const returned = new Map(
    input.activityRows.map((row) => [
      `${iso(row.cohort)}|${row.period}`,
      row.users,
    ]),
  );

  const cohorts: RetentionCohort[] = [];
  for (let index = 0; index < window.cohorts; index += 1) {
    const startMs = window.start.getTime() + index * step;
    const start = new Date(startMs).toISOString();
    const size = sizes.get(start) ?? 0;
    const cells: Array<RetentionCell | null> = [];
    for (let period = 0; period < window.periods; period += 1) {
      const periodStart = startMs + period * step;
      if (periodStart >= nowMs) {
        cells.push(null);
        continue;
      }
      const users =
        period === 0 ? size : (returned.get(`${start}|${period}`) ?? 0);
      cells.push({
        period,
        users,
        rate: size ? users / size : 0,
        status: periodStart + step <= nowMs ? "complete" : "partial",
      });
    }
    cohorts.push({
      start,
      size,
      complete: startMs + step <= nowMs,
      cells,
    });
  }

  const average: RetentionAveragePoint[] = [];
  for (let period = 0; period < window.periods; period += 1) {
    let users = 0;
    let cohortUsers = 0;
    let count = 0;
    for (const cohort of cohorts) {
      const cell = cohort.cells[period];
      if (!cell || cell.status !== "complete" || !cohort.size) continue;
      users += cell.users;
      cohortUsers += cohort.size;
      count += 1;
    }
    average.push({
      period,
      rate: cohortUsers ? users / cohortUsers : null,
      users,
      cohortUsers,
      cohorts: count,
    });
  }

  return {
    range: input.range,
    granularity: window.granularity,
    surface: input.surface,
    returnEvent: input.returnEvent,
    start: window.start.toISOString(),
    end: window.end.toISOString(),
    periods: window.periods,
    lookbackDays: RETENTION_LOOKBACK_DAYS,
    surfaces: input.surfaces,
    cohorts,
    average,
    totals: { users: cohorts.reduce((sum, cohort) => sum + cohort.size, 0) },
  };
}

/**
 * Releases grouped by the cohort period they were deployed in, keyed by the
 * cohort start. Releases outside every cohort are dropped.
 */
export function groupReleasesByCohort<T extends { deployedAt: string }>(
  releases: T[],
  cohortStarts: string[],
  granularity: RetentionGranularity,
) {
  const known = new Set(cohortStarts);
  const grouped = new Map<string, T[]>();
  const sorted = [...releases].sort((left, right) =>
    left.deployedAt.localeCompare(right.deployedAt),
  );
  for (const release of sorted) {
    const key = truncateRetentionPeriod(
      new Date(release.deployedAt),
      granularity,
    ).toISOString();
    if (!known.has(key)) continue;
    grouped.set(key, [...(grouped.get(key) ?? []), release]);
  }
  return grouped;
}

/**
 * In-memory report with the same rules as the SQL query. Used for demo mode
 * and as the executable specification in tests.
 */
export function summarizeRetention(
  events: AnalyticsEventRow[],
  input: {
    project: string;
    range: RetentionRange;
    surface?: RetentionSurface;
    returnEvent?: string | null;
    now?: Date;
  },
): AnalyticsRetentionReport {
  const now = input.now ?? new Date();
  const surface = input.surface ?? "all";
  const returnEvent = normalizeRetentionReturnEvent(input.returnEvent);
  const window = retentionWindow(input.range, now);
  const step = retentionStepMs(window.granularity);
  const at = (event: AnalyticsEventRow) => new Date(event.occurredAt).getTime();
  const project = events.filter(
    (event) =>
      event.project === input.project &&
      at(event) >= window.lookbackStart.getTime() &&
      at(event) < now.getTime(),
  );
  const surfaces = {
    web: project.some((event) => event.name === "site_visit"),
    mobile: project.some((event) => event.name === "app_session"),
  };
  const inSurface = project.filter((event) =>
    matchesRetentionSurface(event.source, surface),
  );
  const entries = new Set(retentionEntryEvents(surface));

  const firstSeen = new Map<string, number>();
  for (const event of inSurface) {
    if (!event.visitorKey || !entries.has(event.name)) continue;
    const previous = firstSeen.get(event.visitorKey);
    if (previous === undefined || at(event) < previous)
      firstSeen.set(event.visitorKey, at(event));
  }
  const cohortOf = new Map<string, number>();
  const sizes = new Map<string, number>();
  for (const [visitor, first] of firstSeen) {
    if (first < window.start.getTime()) continue;
    const cohort = truncateRetentionPeriod(
      new Date(first),
      window.granularity,
    ).getTime();
    cohortOf.set(visitor, cohort);
    const key = new Date(cohort).toISOString();
    sizes.set(key, (sizes.get(key) ?? 0) + 1);
  }

  const returning = new Map<string, Set<string>>();
  for (const event of inSurface) {
    if (!event.visitorKey || at(event) < window.start.getTime()) continue;
    if (returnEvent && event.name !== returnEvent) continue;
    const cohort = cohortOf.get(event.visitorKey);
    if (cohort === undefined) continue;
    const period = Math.round(
      (truncateRetentionPeriod(
        new Date(at(event)),
        window.granularity,
      ).getTime() -
        cohort) /
        step,
    );
    if (period < 1 || period >= window.periods) continue;
    const key = `${new Date(cohort).toISOString()}|${period}`;
    const seen = returning.get(key) ?? new Set<string>();
    seen.add(event.visitorKey);
    returning.set(key, seen);
  }

  return buildRetentionReport({
    range: input.range,
    surface,
    returnEvent,
    now,
    surfaces,
    cohortRows: [...sizes].map(([cohort, users]) => ({ cohort, users })),
    activityRows: [...returning].map(([key, visitors]) => {
      const [cohort = "", period = "0"] = key.split("|");
      return { cohort, period: Number(period), users: visitors.size };
    }),
  });
}
