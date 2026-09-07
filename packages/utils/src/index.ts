export type AnalyticsEventRow = {
  id: string;
  name: string;
  project: string;
  source: "browser" | "server";
  visitorKey: string | null;
  visitKind: "new" | "returning" | null;
  route: string | null;
  referrerHost: string | null;
  campaign?: Record<string, string | undefined> | null;
  occurredAt: string;
  properties: Record<string, string | number | boolean | null>;
};

export type AnalyticsEventSort =
  | "occurred_at"
  | "event_name"
  | "project"
  | "source";

export type AnalyticsEventQuery = {
  organization?: string;
  project?: string;
  projects?: string[];
  names?: string[];
  sources?: Array<"browser" | "server">;
  q?: string;
  start?: string;
  end?: string;
  sort?: `${AnalyticsEventSort}:${"asc" | "desc"}`;
  cursor?: string;
  pageSize?: number;
};

export type AnalyticsEventPage = {
  data: AnalyticsEventRow[];
  meta: { cursor: string | null };
};

export type AnalyticsEventFilterOptions = {
  projects: string[];
  names: string[];
  sources: Array<"browser" | "server">;
};

export type AnalyticsTrendPoint = {
  date: string;
  events: number;
  visitors: number;
};

export type AnalyticsTopEvent = {
  name: string;
  count: number;
};

export type AnalyticsEventNameSummary = {
  name: string;
  count: number;
  previousCount: number;
  change: number;
};

export type AnalyticsEventSourceSummary = {
  source: "browser" | "server";
  count: number;
};

export type AnalyticsEventRouteSummary = {
  route: string;
  count: number;
};

export type AnalyticsEventSummary = {
  totalEvents: number;
  uniqueEventNames: number;
  eventNames: AnalyticsEventNameSummary[];
  sources: AnalyticsEventSourceSummary[];
  routes: AnalyticsEventRouteSummary[];
  acquisition: AnalyticsAcquisitionSummary;
  trend: AnalyticsTrendPoint[];
};

export type AnalyticsAcquisitionSummary = {
  totalVisits: number;
  referrers: Array<{ label: string; count: number }>;
  campaignSources: Array<{ label: string; count: number }>;
};

export function summarizeAcquisition(
  events: AnalyticsEventRow[],
): AnalyticsAcquisitionSummary {
  const visits = events.filter(
    (event) => event.source === "browser" && event.name === "site_visit",
  );
  const group = (labelFor: (event: AnalyticsEventRow) => string) => {
    const counts = new Map<string, number>();
    for (const event of visits) {
      const label = labelFor(event);
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return [...counts]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  };
  return {
    totalVisits: visits.length,
    referrers: group((event) => event.referrerHost || "Direct / unknown"),
    campaignSources: group((event) => event.campaign?.source || "Unattributed"),
  };
}

export type AnalyticsProjectSummary = {
  id: string;
  organizationId: string;
  organizationSlug: string;
  slug: string;
  name: string;
  origin: string;
  status: "healthy" | "quiet" | "attention";
  eventsToday: number;
  visitorsToday: number;
  lastEventAt: string | null;
};

export type AnalyticsOrganizationSummary = {
  id: string;
  slug: string;
  name: string;
  projectCount: number;
};

export type AnalyticsCollectionHealth = {
  recentEvents: number;
  lastReceivedAt: string | null;
  averageLagSeconds: number | null;
  clockSkewEvents: number;
};

export type AnalyticsOverview = {
  uniqueVisitors: number;
  newVisitors: number;
  returningVisitors: number;
  totalEvents: number;
  deliveryRate: number | null;
  collectionHealth: AnalyticsCollectionHealth;
  change: { visitors: number; events: number };
  trend?: AnalyticsTrendPoint[];
  topEvents?: AnalyticsTopEvent[];
};

export function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function validDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function matchesEventQuery(
  event: AnalyticsEventRow,
  query: AnalyticsEventQuery,
  includeDate: boolean,
) {
  const searchable = [
    event.name,
    event.project,
    event.route,
    event.referrerHost,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const start = includeDate ? validDate(query.start) : null;
  const end = includeDate ? validDate(query.end) : null;
  const occurredAt = new Date(event.occurredAt);
  return (
    (!query.project || event.project === query.project) &&
    (!query.projects?.length || query.projects.includes(event.project)) &&
    (!query.names?.length || query.names.includes(event.name)) &&
    (!query.sources?.length || query.sources.includes(event.source)) &&
    (!query.q || searchable.includes(query.q.toLowerCase())) &&
    (!start || occurredAt >= start) &&
    (!end || occurredAt <= end)
  );
}

export function summarizeAnalyticsEvents(
  events: AnalyticsEventRow[],
  query: AnalyticsEventQuery,
  now = new Date(),
): AnalyticsEventSummary {
  const current = events.filter((event) =>
    matchesEventQuery(event, query, true),
  );
  const currentStart = validDate(query.start);
  const currentEnd = validDate(query.end) ?? now;
  const rangeMs = currentStart
    ? Math.max(0, currentEnd.getTime() - currentStart.getTime())
    : 0;
  const previousStart = currentStart
    ? new Date(currentStart.getTime() - rangeMs)
    : null;
  const previous = events.filter((event) => {
    if (!currentStart || !previousStart) return false;
    if (!matchesEventQuery(event, query, false)) return false;
    const occurredAt = new Date(event.occurredAt);
    return occurredAt >= previousStart && occurredAt < currentStart;
  });

  const countBy = <T extends string>(values: T[]) => {
    const counts = new Map<T, number>();
    for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
    return counts;
  };
  const currentNames = countBy(current.map((event) => event.name));
  const previousNames = countBy(previous.map((event) => event.name));
  const eventNames = [...currentNames]
    .map(([name, count]) => {
      const previousCount = previousNames.get(name) ?? 0;
      return {
        name,
        count,
        previousCount,
        change: previousCount
          ? Math.round(((count - previousCount) / previousCount) * 1000) / 10
          : count
            ? 100
            : 0,
      };
    })
    .sort(
      (left, right) =>
        right.count - left.count || left.name.localeCompare(right.name),
    );
  const sources = [...countBy(current.map((event) => event.source))]
    .map(([source, count]) => ({ source, count }))
    .sort((left, right) => right.count - left.count);
  const routes = [
    ...countBy(current.flatMap((event) => (event.route ? [event.route] : []))),
  ]
    .map(([route, count]) => ({ route, count }))
    .sort(
      (left, right) =>
        right.count - left.count || left.route.localeCompare(right.route),
    );
  const trendByDate = new Map<
    string,
    { events: number; visitors: Set<string> }
  >();
  for (const event of current) {
    const date = event.occurredAt.slice(0, 10);
    const bucket = trendByDate.get(date) ?? {
      events: 0,
      visitors: new Set<string>(),
    };
    bucket.events += 1;
    if (event.visitorKey) bucket.visitors.add(event.visitorKey);
    trendByDate.set(date, bucket);
  }

  return {
    totalEvents: current.length,
    acquisition: summarizeAcquisition(current),
    uniqueEventNames: eventNames.length,
    eventNames,
    sources,
    routes,
    trend: [...trendByDate]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([date, bucket]) => ({
        date,
        events: bucket.events,
        visitors: bucket.visitors.size,
      })),
  };
}

export function getDemoAnalytics() {
  const now = Date.now();
  const ago = (minutes: number) =>
    new Date(now - minutes * 60_000).toISOString();
  const events: AnalyticsEventRow[] = [
    {
      id: "evt_01",
      name: "site_visit",
      project: "logly-dashboard",
      source: "browser",
      visitorKey: "v_91a2f8",
      visitKind: "returning",
      route: "/events",
      referrerHost: "direct",
      occurredAt: ago(2),
      properties: { visit_kind: "returning" },
    },
    {
      id: "evt_02",
      name: "project_created",
      project: "afterservice",
      source: "server",
      visitorKey: null,
      visitKind: null,
      route: null,
      referrerHost: null,
      occurredAt: ago(7),
      properties: { plan: "free" },
    },
    {
      id: "evt_03",
      name: "cta_clicked",
      project: "afterservice",
      source: "browser",
      visitorKey: "v_40e3cc",
      visitKind: "new",
      route: "/",
      referrerHost: "google.com",
      occurredAt: ago(12),
      properties: { cta: "join_beta" },
    },
    {
      id: "evt_04",
      name: "site_visit",
      project: "logly-dashboard",
      source: "browser",
      visitorKey: "v_15ad90",
      visitKind: "new",
      route: "/projects",
      referrerHost: "direct",
      occurredAt: ago(21),
      properties: { visit_kind: "new" },
    },
    {
      id: "evt_05",
      name: "follow_up_created",
      project: "afterservice",
      source: "server",
      visitorKey: null,
      visitKind: null,
      route: null,
      referrerHost: null,
      occurredAt: ago(38),
      properties: { channel: "email" },
    },
    {
      id: "evt_06",
      name: "site_visit",
      project: "plot-keys",
      source: "browser",
      visitorKey: "v_64c42d",
      visitKind: "returning",
      route: "/pricing",
      referrerHost: "x.com",
      occurredAt: ago(61),
      properties: { visit_kind: "returning" },
    },
    {
      id: "evt_07",
      name: "signup_completed",
      project: "plot-keys",
      source: "server",
      visitorKey: null,
      visitKind: null,
      route: null,
      referrerHost: null,
      occurredAt: ago(84),
      properties: { method: "email" },
    },
    {
      id: "evt_08",
      name: "site_visit",
      project: "afterservice",
      source: "browser",
      visitorKey: "v_406bda",
      visitKind: "new",
      route: "/pricing",
      referrerHost: "producthunt.com",
      occurredAt: ago(110),
      properties: { visit_kind: "new" },
    },
  ];
  const projects: AnalyticsProjectSummary[] = [
    {
      id: "prj_01",
      organizationId: "org_01",
      organizationSlug: "personal",
      slug: "logly-dashboard",
      name: "Logly",
      origin: "logly.vercel.app",
      status: "healthy",
      eventsToday: 482,
      visitorsToday: 121,
      lastEventAt: ago(2),
    },
    {
      id: "prj_02",
      organizationId: "org_01",
      organizationSlug: "personal",
      slug: "afterservice",
      name: "Afterservice",
      origin: "afterservice.app",
      status: "healthy",
      eventsToday: 276,
      visitorsToday: 88,
      lastEventAt: ago(7),
    },
    {
      id: "prj_03",
      organizationId: "org_01",
      organizationSlug: "personal",
      slug: "plot-keys",
      name: "Plot Keys",
      origin: "plotkeys.com",
      status: "quiet",
      eventsToday: 61,
      visitorsToday: 22,
      lastEventAt: ago(61),
    },
  ];
  return {
    organizations: [
      {
        id: "org_01",
        slug: "personal",
        name: "Personal",
        projectCount: projects.length,
      },
    ] satisfies AnalyticsOrganizationSummary[],
    overview: {
      uniqueVisitors: 231,
      newVisitors: 94,
      returningVisitors: 137,
      totalEvents: 819,
      deliveryRate: null,
      collectionHealth: {
        recentEvents: 0,
        lastReceivedAt: null,
        averageLagSeconds: null,
        clockSkewEvents: 0,
      },
      change: { visitors: 12.4, events: 8.1 },
      trend: Array.from({ length: 14 }, (_, index) => ({
        date: new Date(now - (13 - index) * 86_400_000)
          .toISOString()
          .slice(0, 10),
        events:
          [42, 58, 51, 74, 69, 88, 93, 81, 106, 99, 121, 116, 132, 148][
            index
          ] ?? 0,
        visitors:
          [15, 19, 18, 24, 22, 29, 31, 28, 35, 33, 40, 38, 44, 49][index] ?? 0,
      })),
      topEvents: [
        { name: "site_visit", count: 418 },
        { name: "cta_clicked", count: 164 },
        { name: "project_created", count: 103 },
        { name: "signup_completed", count: 82 },
        { name: "follow_up_created", count: 52 },
      ],
    } satisfies AnalyticsOverview,
    events,
    projects,
  };
}

export {
  type AnalyticsFunnel,
  type AnalyticsFunnelQuery,
  formatFunnelCounts,
  normalizeFunnelQuery,
  summarizeFunnel,
} from "./funnel";
