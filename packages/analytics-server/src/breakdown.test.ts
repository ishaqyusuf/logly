import { afterEach, expect, test } from "bun:test";
import { createAdminClient } from "./index";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("breakdown sends an authenticated, fully encoded read", async () => {
  let request: Request | undefined;
  globalThis.fetch = (async (input, init) => {
    request = new Request(input, init);
    return Response.json({ totals: { events: 3 }, buckets: [] });
  }) as typeof fetch;

  const result = await createAdminClient({
    collectorUrl: "https://collector.logly.test/",
    readKey: "logly_rd_test",
  }).breakdown({
    project: "ewatrade-dashboard",
    start: "2026-11-01T00:00:00.000Z",
    end: "2026-11-08T00:00:00.000Z",
    by: ["name", "property:assistant_channel"],
    metrics: ["events", "actors", "groups"],
    interval: "day",
    limit: 5,
    durationProperty: "duration_ms",
    names: ["assistant_turn_completed", "assistant_turn_failed"],
    propertyKey: "assistant_channel",
    propertyValue: "whatsapp",
  });

  expect(result.totals.events).toBe(3);
  expect(request?.headers.get("authorization")).toBe("Bearer logly_rd_test");
  const url = new URL(request?.url ?? "");
  expect(url.pathname).toBe("/v1/dashboard/breakdown");
  expect(Object.fromEntries(url.searchParams)).toEqual({
    project: "ewatrade-dashboard",
    start: "2026-11-01T00:00:00.000Z",
    end: "2026-11-08T00:00:00.000Z",
    by: "name,property:assistant_channel",
    metrics: "events,actors,groups",
    interval: "day",
    limit: "5",
    durationProperty: "duration_ms",
    names: "assistant_turn_completed,assistant_turn_failed",
    propertyKey: "assistant_channel",
    propertyValue: '"whatsapp"',
  });
});

test("breakdown surfaces collector rejections", async () => {
  globalThis.fetch = (async (_input: RequestInfo | URL, _init?: RequestInit) =>
    Response.json(
      { error: "Invalid metric" },
      { status: 400 },
    )) as typeof fetch;
  await expect(
    createAdminClient({
      collectorUrl: "https://collector.logly.test",
      readKey: "logly_rd_test",
    }).breakdown({
      project: "p",
      start: "2026-11-01T00:00:00Z",
      end: "2026-11-02T00:00:00Z",
      by: ["name"],
    }),
  ).rejects.toThrow("Logly read API returned 400");
});
