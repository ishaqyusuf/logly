import { afterEach, describe, expect, test } from "bun:test";
import type { AnalyticsBatch } from "@ishaqyusuf/logly-core";
import { createAnalyticsRoute } from "./route";

const batch: AnalyticsBatch = {
  sentAt: "2026-09-01T08:00:00.000Z",
  sdk: { name: "@ishaqyusuf/logly-core", version: "0.2.0" },
  events: [
    {
      eventId: "00000000-0000-4000-8000-000000000001",
      project: "logly-dashboard",
      name: "page_view",
      version: 1,
      source: "browser",
      occurredAt: "2026-09-01T08:00:00.000Z",
      route: "/events",
      properties: {},
    },
  ],
};

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("analytics route", () => {
  test("preserves the collector response status", async () => {
    globalThis.fetch = (async () =>
      Response.json(
        { error: "Collector unavailable" },
        { status: 503 },
      )) as unknown as typeof fetch;
    const handler = createAnalyticsRoute({
      collectorUrl: "https://collector.logly.test",
      projectKey: "project-key",
    });

    const response = await handler(
      new Request("https://product.test/api/analytics", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://product.test",
        },
        body: JSON.stringify(batch),
      }),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Collector unavailable" });
  });

  test("accepts a validated batch in local mode", async () => {
    const received: AnalyticsBatch[] = [];
    const handler = createAnalyticsRoute({
      onBatch: async (value) => {
        received.push(value);
      },
    });
    const response = await handler(
      new Request("https://product.test/api/analytics", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(batch),
      }),
    );

    expect(response.status).toBe(202);
    expect(received[0]?.events[0]?.name).toBe("page_view");
  });
});
