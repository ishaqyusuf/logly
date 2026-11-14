import { expect, spyOn, test } from "bun:test";
import type { AnalyticsEventPage } from "@logly/utils";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { isLiveSessionExpired, liveEventsQuery } from "./live-events-query";

const emptyPage: AnalyticsEventPage = { data: [], meta: { cursor: null } };

function observe(scope = { organization: "personal", project: "pilot" }) {
  const client = new QueryClient();
  const options = liveEventsQuery({ initialPage: emptyPage, ...scope });
  const observer = new QueryObserver(client, options);
  const query = observer.getCurrentQuery();
  const { refetchInterval, refetchOnWindowFocus, refetchOnReconnect } = options;
  if (
    typeof refetchInterval !== "function" ||
    typeof refetchOnWindowFocus !== "function" ||
    typeof refetchOnReconnect !== "function"
  ) {
    throw new Error("Live refresh policy must respond to query state");
  }
  return {
    observer,
    interval: () => refetchInterval(query),
    refreshOnFocus: () => refetchOnWindowFocus(query),
    refreshOnReconnect: () => refetchOnReconnect(query),
  };
}

test("uses the scoped server page at mount and requests a moving window", async () => {
  const fetch = spyOn(globalThis, "fetch").mockResolvedValueOnce(
    Response.json(emptyPage),
  );
  const { interval, observer } = observe();
  const unsubscribe = observer.subscribe(() => {});
  try {
    expect(observer.getCurrentResult().data).toEqual(emptyPage);
    expect(fetch).not.toHaveBeenCalled();
    expect(interval()).toBe(30_000);

    const before = Date.now();
    await observer.refetch({ throwOnError: true });
    const [input, request] = fetch.mock.calls[0] ?? [];
    const url = new URL(String(input), "http://localhost");
    const start = Date.parse(url.searchParams.get("start") ?? "");
    expect(url.pathname).toBe("/api/dashboard/events");
    expect(url.searchParams.get("organization")).toBe("personal");
    expect(url.searchParams.get("project")).toBe("pilot");
    expect(url.searchParams.get("pageSize")).toBe("50");
    expect(start + 15 * 60_000).toBeGreaterThanOrEqual(before);
    expect(start + 15 * 60_000).toBeLessThanOrEqual(Date.now());
    expect(request?.signal).toBeInstanceOf(AbortSignal);
    expect(request?.redirect).toBe("manual");
  } finally {
    unsubscribe();
    fetch.mockRestore();
  }
});

test.each([
  [400, false],
  [401, false],
  [403, false],
  [429, 30_000],
  [503, 30_000],
] as const)("makes one attempt for HTTP %i", async (status, nextInterval) => {
  const fetch = spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({ error: "Request failed" }, { status }),
  );
  const { interval, observer, refreshOnFocus, refreshOnReconnect } = observe();
  try {
    const result = await observer.refetch();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.data).toEqual(emptyPage);
    expect(result.isError).toBe(true);
    expect(isLiveSessionExpired(result.error)).toBe(
      status === 401 || status === 403,
    );
    expect(interval()).toBe(nextInterval);
    expect(refreshOnFocus()).toBe(Boolean(nextInterval));
    expect(refreshOnReconnect()).toBe(Boolean(nextInterval));
  } finally {
    fetch.mockRestore();
  }
});
