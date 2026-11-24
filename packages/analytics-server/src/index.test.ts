import { afterEach, describe, expect, test } from "bun:test";
import { createAdminClient, createServerAnalytics, signBatch } from "./index";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("server analytics", () => {
  test("sends a signed, sanitized batch with the published package identity", async () => {
    let request: Request | undefined;
    globalThis.fetch = (async (input, init) => {
      request = new Request(input, init);
      return Response.json({ accepted: 1 }, { status: 202 });
    }) as typeof fetch;

    const client = createServerAnalytics({
      collectorUrl: "https://collector.logly.test/",
      project: "afterservice",
      serverKey: "server-secret",
    });
    await client.track("job_completed", {
      safe: true,
      nested: { must: "be removed" },
    });

    expect(request?.url).toBe("https://collector.logly.test/v1/events");
    expect(request?.headers.get("authorization")).toBe("Bearer server-secret");
    const body = await request?.text();
    expect(body).toBeDefined();
    expect(request?.headers.get("x-logly-signature")).toBe(
      signBatch(JSON.parse(body ?? "{}"), "server-secret"),
    );
    const batch = JSON.parse(body ?? "{}") as {
      events: Array<{ properties: Record<string, unknown> }>;
      sdk: { name: string; version: string };
    };
    expect(batch.sdk).toEqual({
      name: "@ishaqyusuf/logly-core",
      version: "0.3.0",
    });
    expect(batch.events[0]?.properties).toEqual({ safe: true });
  });

  test("authenticates scoped dashboard reads", async () => {
    let request: Request | undefined;
    globalThis.fetch = (async (input, init) => {
      request = new Request(input, init);
      return Response.json({ events: [] });
    }) as typeof fetch;

    const client = createAdminClient({
      collectorUrl: "https://collector.logly.test/",
      readKey: "read-secret",
    });
    await client.read("/v1/dashboard/events?project=afterservice");

    expect(request?.url).toBe(
      "https://collector.logly.test/v1/dashboard/events?project=afterservice",
    );
    expect(request?.headers.get("authorization")).toBe("Bearer read-secret");
  });
});

test("concurrent server calls keep request-scoped group and retry identity", async () => {
  const batches: Array<{
    events: Array<{
      eventId: string;
      actorId: string;
      occurredAt: string;
      groups: { business: { key: string } };
    }>;
  }> = [];
  globalThis.fetch = (async (_input, init) => {
    batches.push(JSON.parse(String(init?.body)));
    return Response.json({ accepted: 1 });
  }) as typeof fetch;
  const client = createServerAnalytics({
    project: "test-project",
    collectorUrl: "https://collector.test",
    serverKey: "secret",
  });
  const occurredAt = "2026-10-01T00:00:00.000Z";
  const eventId = "00000000-0000-4000-8000-000000000001";
  await Promise.all([
    client.track("first", {}, "user-one", {
      groups: { business: { key: "first" } },
      eventId,
      occurredAt,
    }),
    client.track("second", {}, "user-two", {
      groups: { business: { key: "second" } },
    }),
  ]);
  expect(batches[0]?.events[0]).toMatchObject({
    eventId,
    occurredAt,
    actorId: "user-one",
    groups: { business: { key: "first" } },
  });
  expect(batches[1]?.events[0]).toMatchObject({
    actorId: "user-two",
    groups: { business: { key: "second" } },
  });
});
