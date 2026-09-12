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
