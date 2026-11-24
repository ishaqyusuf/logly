import type { AnalyticsEventRow } from "./index";

// Funnel read contract shared by the collector route, the SQL query, the
// dashboard builder and saved funnels. Parsing is strict so a caller never
// receives a silently broadened funnel.
//
// Semantics (see .brain/features/funnels.md):
// - A visitor is a project-scoped `visitorKey`. Events without one are
//   excluded; every source (browser, mobile, server) counts when it carries one.
// - A visitor enters at their earliest step-1 event in the date range. Later
//   step-1 events do not re-enter them (one attempt per visitor per range).
// - Step N is the earliest matching event strictly after the time step N-1
//   was reached and no later than entry + conversion window, inside the range.
// - Each visitor counts at most once per step. One event never satisfies two
//   steps, so a repeated step needs a separate, later occurrence.

export const FUNNEL_MIN_STEPS = 2;
export const FUNNEL_MAX_STEPS = 8;
export const FUNNEL_MAX_RANGE_DAYS = 90;
export const FUNNEL_DEFAULT_RANGE_DAYS = 30;
/** Entrants beyond this (earliest first) are not followed; `capped` is set. */
export const FUNNEL_VISITOR_CAP = 50_000;
/** Breakdown keeps this many values by entrants and folds the rest. */
export const FUNNEL_BREAKDOWN_LIMIT = 5;
export const FUNNEL_NONE = "(none)";
export const FUNNEL_OTHER = "(other)";
export const FUNNEL_MAX_NAME_LENGTH = 80;
export const FUNNEL_MAX_SAVED_PER_PROJECT = 50;
export const FUNNEL_MAX_BODY_BYTES = 8_192;

export const FUNNEL_WINDOWS = {
  "1h": 3_600,
  "1d": 86_400,
  "7d": 604_800,
  "30d": 2_592_000,
} as const;
export type FunnelWindow = keyof typeof FUNNEL_WINDOWS;
export const FUNNEL_DEFAULT_WINDOW: FunnelWindow = "1d";

export const FUNNEL_BREAKDOWNS = [
  "platform",
  "country",
  "app_version",
  "source",
] as const;
export type FunnelBreakdown = (typeof FUNNEL_BREAKDOWNS)[number];

export type FunnelStep = {
  event: string;
  /** Exact recorded route template, e.g. `/orders/:id`. */
  route?: string;
  /** One stored property, compared as text. */
  property?: { key: string; value: string };
};

export type AnalyticsFunnelQuery = {
  project: string;
  organization?: string;
  /** Plain event names are accepted for the original step list contract. */
  steps: Array<string | FunnelStep>;
  window?: FunnelWindow;
  start?: string;
  end?: string;
  breakdown?: FunnelBreakdown;
};

export type NormalizedFunnelQuery = {
  project: string;
  organization?: string;
  steps: FunnelStep[];
  window: FunnelWindow;
  start: string;
  end: string;
  breakdown?: FunnelBreakdown;
};

export type AnalyticsFunnelStep = {
  name: string;
  route: string | null;
  property: { key: string; value: string } | null;
  visitors: number;
  /** % of step 1, one decimal. */
  conversion: number;
  /** % of the previous step, one decimal (100 for step 1). */
  stepConversion: number;
  /** Visitors lost since the previous step (0 for step 1). */
  dropOff: number;
  /** Median seconds from the previous step; null for step 1 or no data. */
  medianSeconds: number | null;
};

export type AnalyticsFunnelSegment = { value: string; counts: number[] };

export type AnalyticsFunnel = {
  start: string;
  end: string;
  window: FunnelWindow;
  breakdown: FunnelBreakdown | null;
  visitorCap: number;
  /** More visitors entered than `visitorCap`; only the earliest were followed. */
  capped: boolean;
  steps: AnalyticsFunnelStep[];
  segments: AnalyticsFunnelSegment[];
};

export type SavedFunnel = {
  id: string;
  name: string;
  steps: FunnelStep[];
  window: FunnelWindow;
  createdAt: string;
  updatedAt: string;
};

export type FunnelEventOption = { name: string; properties: string[] };
export type FunnelOptions = {
  funnels: SavedFunnel[];
  events: FunnelEventOption[];
  routes: string[];
};

export type SavedFunnelInput = {
  project: string;
  name: string;
  steps: FunnelStep[];
  window: FunnelWindow;
};

const PROJECT = /^[a-z0-9-]{2,64}$/;
const EVENT = /^[a-z][a-z0-9_.]{0,79}$/;
const PROPERTY_KEY = /^[a-z][a-z0-9_]{0,63}$/;
const ROUTE = /^\/[A-Za-z0-9/:_.~\-[\]]{0,199}$/;
const DAY_MS = 86_400_000;

export class FunnelQueryError extends Error {}

export function isFunnelWindow(value: unknown): value is FunnelWindow {
  return typeof value === "string" && Object.hasOwn(FUNNEL_WINDOWS, value);
}
export function isFunnelBreakdown(value: unknown): value is FunnelBreakdown {
  return (
    typeof value === "string" &&
    (FUNNEL_BREAKDOWNS as readonly string[]).includes(value)
  );
}

function normalizeStep(input: unknown): FunnelStep {
  const raw = typeof input === "string" ? { event: input } : input;
  if (!raw || typeof raw !== "object")
    throw new FunnelQueryError("Each step needs an event name");
  const { event, route, property } = raw as Record<string, unknown>;
  if (typeof event !== "string" || !EVENT.test(event))
    throw new FunnelQueryError("Each step needs a valid event name");
  const step: FunnelStep = { event };
  if (route !== undefined && route !== null && route !== "") {
    if (typeof route !== "string" || !ROUTE.test(route))
      throw new FunnelQueryError(
        "A route filter must be a recorded template such as /orders/:id",
      );
    step.route = route;
  }
  if (property !== undefined && property !== null) {
    const { key, value } = property as Record<string, unknown>;
    if (typeof key !== "string" || !PROPERTY_KEY.test(key))
      throw new FunnelQueryError("A property filter needs a valid key");
    if (typeof value !== "string" || value.length === 0 || value.length > 200)
      throw new FunnelQueryError(
        "A property filter needs a value of 1 to 200 characters",
      );
    step.property = { key, value };
  }
  return step;
}

export function normalizeFunnelSteps(input: unknown): FunnelStep[] {
  if (!Array.isArray(input)) throw new FunnelQueryError("Steps must be a list");
  if (input.length < FUNNEL_MIN_STEPS || input.length > FUNNEL_MAX_STEPS)
    throw new FunnelQueryError(
      `Choose ${FUNNEL_MIN_STEPS} to ${FUNNEL_MAX_STEPS} steps`,
    );
  return input.map(normalizeStep);
}

/**
 * Steps from a query string: a JSON array of steps, or the original
 * comma-separated event names.
 */
export function parseFunnelStepsParam(value: string | null | undefined) {
  if (!value) return [];
  if (value.trimStart().startsWith("[")) {
    try {
      return JSON.parse(value) as unknown[];
    } catch {
      throw new FunnelQueryError("Steps are not valid JSON");
    }
  }
  return value.split(",").filter(Boolean);
}

export function serializeFunnelSteps(steps: FunnelStep[]) {
  return JSON.stringify(
    steps.map((step) => ({
      event: step.event,
      ...(step.route ? { route: step.route } : {}),
      ...(step.property ? { property: step.property } : {}),
    })),
  );
}

export function normalizeFunnelQuery(
  query: AnalyticsFunnelQuery,
  now = new Date(),
): NormalizedFunnelQuery {
  if (!PROJECT.test(query.project))
    throw new FunnelQueryError("A valid project is required");
  const steps = normalizeFunnelSteps(query.steps);
  const window = query.window ?? FUNNEL_DEFAULT_WINDOW;
  if (!isFunnelWindow(window))
    throw new FunnelQueryError("Choose a window of 1h, 1d, 7d or 30d");
  if (query.breakdown !== undefined && !isFunnelBreakdown(query.breakdown))
    throw new FunnelQueryError(
      "Break down by platform, country, app_version or source",
    );
  const end = query.end ? new Date(query.end) : now;
  const start = query.start
    ? new Date(query.start)
    : new Date(end.getTime() - FUNNEL_DEFAULT_RANGE_DAYS * DAY_MS);
  if (
    !Number.isFinite(start.getTime()) ||
    !Number.isFinite(end.getTime()) ||
    start >= end ||
    end.getTime() - start.getTime() > FUNNEL_MAX_RANGE_DAYS * DAY_MS
  )
    throw new FunnelQueryError(
      `Choose an ordered date range of at most ${FUNNEL_MAX_RANGE_DAYS} days`,
    );
  return {
    project: query.project,
    ...(query.organization ? { organization: query.organization } : {}),
    steps,
    window,
    start: start.toISOString(),
    end: end.toISOString(),
    ...(query.breakdown ? { breakdown: query.breakdown } : {}),
  };
}

export function parseSavedFunnelInput(
  body: unknown,
): { ok: true; data: SavedFunnelInput } | { ok: false; error: string } {
  if (!body || typeof body !== "object")
    return { ok: false, error: "A JSON body is required" };
  const { project, name, steps, window } = body as Record<string, unknown>;
  if (typeof project !== "string" || !PROJECT.test(project))
    return { ok: false, error: "A valid project is required" };
  const trimmed = typeof name === "string" ? name.trim() : "";
  if (!trimmed || trimmed.length > FUNNEL_MAX_NAME_LENGTH)
    return {
      ok: false,
      error: `Name the funnel (1 to ${FUNNEL_MAX_NAME_LENGTH} characters)`,
    };
  if (!isFunnelWindow(window))
    return { ok: false, error: "Choose a window of 1h, 1d, 7d or 30d" };
  try {
    return {
      ok: true,
      data: {
        project,
        name: trimmed,
        steps: normalizeFunnelSteps(steps),
        window,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Invalid steps",
    };
  }
}

export function funnelStepLabel(step: FunnelStep) {
  const parts = [step.event];
  if (step.route) parts.push(`on ${step.route}`);
  if (step.property)
    parts.push(`where ${step.property.key} = ${step.property.value}`);
  return parts.join(" ");
}

const round1 = (value: number) => Math.round(value * 10) / 10;

/** Per-step rows grouped by segment, as returned by the SQL query. */
export type FunnelCountRow = {
  step: number;
  /** Segment value; null for the all-visitors total row. */
  segment: string | null;
  total: boolean;
  count: number;
  medianSeconds: number | null;
};

export function formatFunnelResult(
  query: NormalizedFunnelQuery,
  rows: FunnelCountRow[],
  capped: boolean,
): AnalyticsFunnel {
  const counts = query.steps.map(() => 0);
  const medians: Array<number | null> = query.steps.map(() => null);
  const bySegment = new Map<string, number[]>();
  for (const row of rows) {
    if (row.step < 0 || row.step >= query.steps.length) continue;
    if (row.total) {
      counts[row.step] = row.count;
      medians[row.step] =
        row.medianSeconds === null ? null : Math.round(row.medianSeconds);
      continue;
    }
    const value = row.segment ?? FUNNEL_NONE;
    const list = bySegment.get(value) ?? query.steps.map(() => 0);
    list[row.step] = (list[row.step] ?? 0) + row.count;
    bySegment.set(value, list);
  }
  const first = counts[0] ?? 0;
  const steps = query.steps.map((step, index): AnalyticsFunnelStep => {
    const visitors = counts[index] ?? 0;
    const previous = index === 0 ? visitors : (counts[index - 1] ?? 0);
    return {
      name: step.event,
      route: step.route ?? null,
      property: step.property ?? null,
      visitors,
      conversion: first ? round1((visitors / first) * 100) : 0,
      stepConversion:
        index === 0 ? 100 : previous ? round1((visitors / previous) * 100) : 0,
      dropOff: index === 0 ? 0 : previous - visitors,
      medianSeconds: index === 0 ? null : (medians[index] ?? null),
    };
  });
  let segments: AnalyticsFunnelSegment[] = [];
  if (query.breakdown) {
    const ranked = [...bySegment.entries()].sort(
      (a, b) => (b[1][0] ?? 0) - (a[1][0] ?? 0) || a[0].localeCompare(b[0]),
    );
    segments = ranked
      .slice(0, FUNNEL_BREAKDOWN_LIMIT)
      .map(([value, list]) => ({ value, counts: list }));
    const rest = ranked.slice(FUNNEL_BREAKDOWN_LIMIT);
    if (rest.length)
      segments.push({
        value: FUNNEL_OTHER,
        counts: query.steps.map((_, index) =>
          rest.reduce((sum, [, list]) => sum + (list[index] ?? 0), 0),
        ),
      });
  }
  return {
    start: query.start,
    end: query.end,
    window: query.window,
    breakdown: query.breakdown ?? null,
    visitorCap: FUNNEL_VISITOR_CAP,
    capped,
    steps,
    segments,
  };
}

function matchesStep(event: AnalyticsEventRow, step: FunnelStep) {
  if (event.name !== step.event) return false;
  if (step.route && event.route !== step.route) return false;
  if (step.property) {
    const value = event.properties?.[step.property.key];
    if (value === undefined || value === null) return false;
    if (String(value) !== step.property.value) return false;
  }
  return true;
}

function segmentOf(event: AnalyticsEventRow, breakdown: FunnelBreakdown) {
  const value =
    breakdown === "platform"
      ? event.platform
      : breakdown === "country"
        ? event.country
        : breakdown === "app_version"
          ? event.appVersion
          : event.source;
  return value?.trim() ? value : null;
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = (sorted.length - 1) / 2;
  const low = sorted[Math.floor(middle)] ?? 0;
  const high = sorted[Math.ceil(middle)] ?? 0;
  return (low + high) / 2;
}

/**
 * In-memory funnel with the same semantics as the SQL query. Used for demo
 * data and as the specification the SQL fixture test compares against.
 */
export function summarizeFunnel(
  events: AnalyticsEventRow[],
  input: AnalyticsFunnelQuery,
  visitorCap = FUNNEL_VISITOR_CAP,
): AnalyticsFunnel {
  const query = normalizeFunnelQuery(input);
  const startMs = Date.parse(query.start);
  const endMs = Date.parse(query.end);
  const windowMs = FUNNEL_WINDOWS[query.window] * 1000;
  const byVisitor = new Map<string, AnalyticsEventRow[]>();
  for (const event of events) {
    if (event.project !== query.project || !event.visitorKey) continue;
    const time = Date.parse(event.occurredAt);
    if (time < startMs || time > endMs) continue;
    if (!query.steps.some((step) => step.event === event.name)) continue;
    const list = byVisitor.get(event.visitorKey) ?? [];
    list.push(event);
    byVisitor.set(event.visitorKey, list);
  }
  const first = query.steps[0] as FunnelStep;
  const entrants: Array<{
    events: AnalyticsEventRow[];
    entry: AnalyticsEventRow;
  }> = [];
  for (const list of byVisitor.values()) {
    list.sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));
    const entry = list.find((event) => matchesStep(event, first));
    if (entry) entrants.push({ events: list, entry });
  }
  entrants.sort(
    (a, b) => Date.parse(a.entry.occurredAt) - Date.parse(b.entry.occurredAt),
  );
  const capped = entrants.length > visitorCap;
  const rows: FunnelCountRow[] = [];
  const totals = query.steps.map(() => 0);
  const gaps: number[][] = query.steps.map(() => []);
  const segmentCounts = new Map<string | null, number[]>();
  for (const { events: list, entry } of entrants.slice(0, visitorCap)) {
    const entered = Date.parse(entry.occurredAt);
    const segment = query.breakdown ? segmentOf(entry, query.breakdown) : null;
    const counts = segmentCounts.get(segment) ?? query.steps.map(() => 0);
    segmentCounts.set(segment, counts);
    let reached = entered;
    for (const [index, step] of query.steps.entries()) {
      if (index > 0) {
        const next = list.find((event) => {
          const time = Date.parse(event.occurredAt);
          return (
            time > reached &&
            time <= entered + windowMs &&
            matchesStep(event, step)
          );
        });
        if (!next) break;
        const time = Date.parse(next.occurredAt);
        gaps[index]?.push((time - reached) / 1000);
        reached = time;
      }
      totals[index] = (totals[index] ?? 0) + 1;
      counts[index] = (counts[index] ?? 0) + 1;
    }
  }
  for (const [index, count] of totals.entries()) {
    rows.push({
      step: index,
      segment: null,
      total: true,
      count,
      medianSeconds: median(gaps[index] ?? []),
    });
  }
  if (query.breakdown)
    for (const [segment, counts] of segmentCounts)
      for (const [index, count] of counts.entries())
        if (count)
          rows.push({
            step: index,
            segment,
            total: false,
            count,
            medianSeconds: null,
          });
  return formatFunnelResult(query, rows, capped);
}

/** Known events and property keys for the builder, from demo events. */
export function summarizeFunnelOptions(
  events: AnalyticsEventRow[],
  project: string,
  funnels: SavedFunnel[] = [],
): FunnelOptions {
  const names = new Map<string, { count: number; keys: Set<string> }>();
  const routes = new Map<string, number>();
  for (const event of events) {
    if (event.project !== project) continue;
    const entry = names.get(event.name) ?? { count: 0, keys: new Set() };
    entry.count++;
    for (const key of Object.keys(event.properties ?? {}))
      if (PROPERTY_KEY.test(key)) entry.keys.add(key);
    names.set(event.name, entry);
    if (event.route)
      routes.set(event.route, (routes.get(event.route) ?? 0) + 1);
  }
  return {
    funnels,
    events: [...names.entries()]
      .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))
      .slice(0, 200)
      .map(([name, entry]) => ({
        name,
        properties: [...entry.keys].sort().slice(0, 50),
      })),
    routes: [...routes.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 100)
      .map(([route]) => route),
  };
}
