import type { AnalyticsEventRow, AnalyticsOverviewRange } from "./index";

/** Browser projects report `page_view`; mobile projects report `screen_view`. */
export type AnalyticsPageViewEvent = "page_view" | "screen_view";

export const PAGE_VIEW_EVENTS: readonly AnalyticsPageViewEvent[] = [
  "page_view",
  "screen_view",
];

export const PAGES_REPORT_LIMIT = 25;
export const PAGES_ENTRY_EXIT_LIMIT = 10;

const RANGE_HOURS: Record<AnalyticsOverviewRange, number> = {
  "24h": 24,
  "7d": 168,
  "30d": 720,
};

export type AnalyticsPageRow = {
  /** Recorded route as stored: a template, a raw path, `/other`, or null. */
  route: string | null;
  views: number;
  visitors: number;
  previousViews: number;
  previousVisitors: number;
};

export type AnalyticsPageEdgeRow = {
  route: string | null;
  /** Visitor-days whose first (entry) or last (exit) view was this route. */
  count: number;
};

export type AnalyticsPagesReport = {
  view: AnalyticsPageViewEvent;
  range: AnalyticsOverviewRange;
  start: string;
  end: string;
  previousStart: string;
  /** Views of each kind in the current window, so the UI can offer a toggle. */
  available: Record<AnalyticsPageViewEvent, number>;
  totals: {
    views: number;
    visitors: number;
    previousViews: number;
    previousVisitors: number;
    /** Visitor-days (UTC) with at least one view: the entry/exit denominator. */
    visitorDays: number;
  };
  pages: AnalyticsPageRow[];
  entries: AnalyticsPageEdgeRow[];
  exits: AnalyticsPageEdgeRow[];
};

export function parsePageViewEvent(
  value: string | null | undefined,
): AnalyticsPageViewEvent | undefined {
  return PAGE_VIEW_EVENTS.find((event) => event === value);
}

/** Rolling window ending now and the immediately preceding equal window (as Pulse). */
export function pagesReportWindow(range: AnalyticsOverviewRange, now: Date) {
  const duration = RANGE_HOURS[range] * 3_600_000;
  const start = new Date(now.getTime() - duration);
  return {
    start,
    end: now,
    previousStart: new Date(start.getTime() - duration),
  };
}

/** The requested view, else whichever view has data (page views win ties). */
export function choosePageViewEvent(
  available: Record<AnalyticsPageViewEvent, number>,
  requested?: AnalyticsPageViewEvent,
): AnalyticsPageViewEvent {
  if (requested) return requested;
  return available.page_view === 0 && available.screen_view > 0
    ? "screen_view"
    : "page_view";
}

/**
 * In-memory Pages report with the same rules as the SQL query. Used for demo
 * mode and as the executable specification in tests.
 */
export function summarizePages(
  events: AnalyticsEventRow[],
  input: {
    project: string;
    range: AnalyticsOverviewRange;
    view?: AnalyticsPageViewEvent;
    now?: Date;
  },
): AnalyticsPagesReport {
  const window = pagesReportWindow(input.range, input.now ?? new Date());
  const inWindow = (event: AnalyticsEventRow, from: Date, to: Date) => {
    const at = new Date(event.occurredAt).getTime();
    return at >= from.getTime() && at < to.getTime();
  };
  const scoped = events.filter((event) => event.project === input.project);
  const current = scoped.filter((event) =>
    inWindow(event, window.start, window.end),
  );
  const available = {
    page_view: current.filter((event) => event.name === "page_view").length,
    screen_view: current.filter((event) => event.name === "screen_view").length,
  };
  const view = choosePageViewEvent(available, input.view);
  const views = current.filter((event) => event.name === view);
  const previous = scoped.filter(
    (event) =>
      event.name === view &&
      inWindow(event, window.previousStart, window.start),
  );

  const byRoute = (rows: AnalyticsEventRow[]) => {
    const map = new Map<
      string | null,
      { views: number; visitors: Set<string> }
    >();
    for (const event of rows) {
      const entry = map.get(event.route) ?? { views: 0, visitors: new Set() };
      entry.views += 1;
      if (event.visitorKey) entry.visitors.add(event.visitorKey);
      map.set(event.route, entry);
    }
    return map;
  };
  const currentRoutes = byRoute(views);
  const previousRoutes = byRoute(previous);
  const pages = [...currentRoutes.entries()]
    .map(([route, entry]) => ({
      route,
      views: entry.views,
      visitors: entry.visitors.size,
      previousViews: previousRoutes.get(route)?.views ?? 0,
      previousVisitors: previousRoutes.get(route)?.visitors.size ?? 0,
    }))
    .sort(
      (a, b) =>
        b.views - a.views || String(a.route).localeCompare(String(b.route)),
    )
    .slice(0, PAGES_REPORT_LIMIT);

  const days = new Map<string, AnalyticsEventRow[]>();
  for (const event of views) {
    if (!event.visitorKey) continue;
    const key = `${event.visitorKey}|${event.occurredAt.slice(0, 10)}`;
    days.set(key, [...(days.get(key) ?? []), event]);
  }
  const edge = (pick: (rows: AnalyticsEventRow[]) => AnalyticsEventRow) => {
    const counts = new Map<string | null, number>();
    for (const rows of days.values()) {
      const route = pick(rows).route;
      counts.set(route, (counts.get(route) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([route, count]) => ({ route, count }))
      .sort(
        (a, b) =>
          b.count - a.count || String(a.route).localeCompare(String(b.route)),
      )
      .slice(0, PAGES_ENTRY_EXIT_LIMIT);
  };
  const ordered = (rows: AnalyticsEventRow[]) =>
    [...rows].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));

  const visitorCount = (rows: AnalyticsEventRow[]) =>
    new Set(
      rows.flatMap((event) => (event.visitorKey ? [event.visitorKey] : [])),
    ).size;
  return {
    view,
    range: input.range,
    start: window.start.toISOString(),
    end: window.end.toISOString(),
    previousStart: window.previousStart.toISOString(),
    available,
    totals: {
      views: views.length,
      visitors: visitorCount(views),
      previousViews: previous.length,
      previousVisitors: visitorCount(previous),
      visitorDays: days.size,
    },
    pages,
    entries: edge((rows) => ordered(rows)[0] as AnalyticsEventRow),
    exits: edge((rows) => ordered(rows).at(-1) as AnalyticsEventRow),
  };
}
