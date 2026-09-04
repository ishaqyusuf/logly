import { createAdminClient } from "@ishaqyusuf/logly-server";
import {
  type AnalyticsEventFilterOptions,
  type AnalyticsEventPage,
  type AnalyticsEventQuery,
  type AnalyticsEventRow,
  type AnalyticsEventSummary,
  type AnalyticsOrganizationSummary,
  type AnalyticsOverview,
  type AnalyticsProjectSummary,
  getDemoAnalytics,
  summarizeAnalyticsEvents,
} from "@logly/utils";
import { cache } from "react";

export type DashboardData = {
  mode: "demo" | "database";
  overview: AnalyticsOverview;
  events: AnalyticsEventRow[];
  organizations: AnalyticsOrganizationSummary[];
  projects: AnalyticsProjectSummary[];
};

const getDashboardDataCached = cache(
  async (organization?: string, project?: string): Promise<DashboardData> => {
    const collectorUrl = process.env.NEXT_PUBLIC_API_URL;
    const readKey = process.env.LOGLY_READ_KEY;
    const demoMode = process.env.NODE_ENV !== "production";
    if (!collectorUrl || !readKey) {
      if (demoMode) return { ...getDemoAnalytics(), mode: "demo" };
      throw new Error(
        "NEXT_PUBLIC_API_URL and LOGLY_READ_KEY are required in production",
      );
    }

    try {
      return await createAdminClient({
        collectorUrl,
        readKey,
      }).read<DashboardData>(
        `/v1/dashboard/overview?${new URLSearchParams(
          Object.entries({ organization, project }).filter(
            (entry): entry is [string, string] => Boolean(entry[1]),
          ),
        )}`,
      );
    } catch (error) {
      if (demoMode) return { ...getDemoAnalytics(), mode: "demo" };
      throw error;
    }
  },
);

export function getDashboardData(filters?: {
  organization?: string;
  project?: string;
}) {
  return getDashboardDataCached(filters?.organization, filters?.project);
}

function dashboardClient() {
  const collectorUrl = process.env.NEXT_PUBLIC_API_URL;
  const readKey = process.env.LOGLY_READ_KEY;
  if (!collectorUrl || !readKey) return null;
  return createAdminClient({ collectorUrl, readKey });
}

function queryString(query: AnalyticsEventQuery) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, Array.isArray(value) ? value.join(",") : String(value));
  }
  return params.toString();
}

export async function getDashboardEventPage(
  query: AnalyticsEventQuery,
): Promise<AnalyticsEventPage> {
  const client = dashboardClient();
  if (!client) {
    const events = getDemoAnalytics().events.filter((event) => {
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
    return {
      data: events.slice(0, query.pageSize ?? 50),
      meta: { cursor: null },
    };
  }
  return client.read<AnalyticsEventPage>(
    `/v1/dashboard/events?${queryString(query)}`,
  );
}

export async function getDashboardEventOptions(
  query: Pick<AnalyticsEventQuery, "organization" | "project">,
): Promise<AnalyticsEventFilterOptions> {
  const client = dashboardClient();
  if (!client) {
    const events = getDemoAnalytics().events.filter(
      (event) => !query.project || event.project === query.project,
    );
    return {
      projects: [...new Set(events.map((event) => event.project))].sort(),
      names: [...new Set(events.map((event) => event.name))].sort(),
      sources: [...new Set(events.map((event) => event.source))].sort(),
    };
  }
  return client.read<AnalyticsEventFilterOptions>(
    `/v1/dashboard/event-options?${queryString(query)}`,
  );
}

export async function getDashboardEventSummary(
  query: AnalyticsEventQuery,
): Promise<AnalyticsEventSummary> {
  const client = dashboardClient();
  if (!client) {
    return summarizeAnalyticsEvents(getDemoAnalytics().events, query);
  }
  return client.read<AnalyticsEventSummary>(
    `/v1/dashboard/event-summary?${queryString(query)}`,
  );
}

export async function getDashboardEventById(
  eventId: string,
  project: string,
): Promise<AnalyticsEventRow | null> {
  const client = dashboardClient();
  if (!client) {
    return (
      getDemoAnalytics().events.find(
        (event) => event.id === eventId && event.project === project,
      ) ?? null
    );
  }
  return client.read<AnalyticsEventRow>(
    `/v1/dashboard/events/${encodeURIComponent(eventId)}?${queryString({ project })}`,
  );
}
