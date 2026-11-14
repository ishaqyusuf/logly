import type { AnalyticsEventPage } from "@logly/utils";
import { queryOptions } from "@tanstack/react-query";

const activeInterval = 10_000;
const idleInterval = 30_000;
const liveWindow = 15 * 60_000;

class LiveEventsError extends Error {
  constructor(readonly status: number) {
    super("Could not refresh live events");
  }
}

export function isLiveSessionExpired(error: Error | null) {
  return (
    error instanceof LiveEventsError &&
    (error.status === 401 || error.status === 403)
  );
}

function canRefresh(error: Error | null) {
  if (!(error instanceof LiveEventsError)) return true;
  return error.status === 408 || error.status === 429 || error.status >= 500;
}

export function liveEventsQuery({
  initialPage,
  organization,
  project,
}: {
  initialPage: AnalyticsEventPage;
  organization?: string;
  project: string;
}) {
  return queryOptions({
    queryKey: ["dashboard-live-events", organization, project],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({
        project,
        pageSize: "50",
        start: new Date(Date.now() - liveWindow).toISOString(),
      });
      if (organization) params.set("organization", organization);
      const response = await fetch(`/api/dashboard/events?${params}`, {
        redirect: "manual",
        signal,
      });
      // The auth proxy can redirect when a session cookie is absent.
      if (response.type === "opaqueredirect") throw new LiveEventsError(401);
      if (!response.ok) throw new LiveEventsError(response.status);
      return response.json() as Promise<AnalyticsEventPage>;
    },
    initialData: initialPage,
    staleTime: activeInterval,
    retry: false,
    refetchInterval: ({ state }) => {
      if (!canRefresh(state.error)) return false;
      return state.error || !state.data?.data.length
        ? idleInterval
        : activeInterval;
    },
    refetchOnWindowFocus: ({ state }) => canRefresh(state.error),
    refetchOnReconnect: ({ state }) => canRefresh(state.error),
  });
}
