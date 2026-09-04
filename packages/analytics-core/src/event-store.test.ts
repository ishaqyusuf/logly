import { describe, expect, test } from "bun:test";
import type { AnalyticsEvent } from "./contracts";
import { createMemoryEventStore } from "./event-store";

function event(eventId: string, occurredAt: string): AnalyticsEvent {
  return {
    eventId,
    project: "logly-dashboard",
    name: "page_view",
    version: 1,
    source: "browser",
    occurredAt,
    properties: {},
  };
}

describe("analytics event store", () => {
  test("prunes expired and oldest records to the configured cap", async () => {
    const store = createMemoryEventStore();
    const firstId = "00000000-0000-4000-8000-000000000001";
    const secondId = "00000000-0000-4000-8000-000000000002";
    const thirdId = "00000000-0000-4000-8000-000000000003";
    await store.enqueue(event(firstId, "2026-08-30T09:00:00.000Z"), 1, 5);
    await store.enqueue(event(secondId, "2026-08-30T09:01:00.000Z"), 2, 20);
    await store.enqueue(event(thirdId, "2026-08-30T09:02:00.000Z"), 3, 20);

    await store.prune("logly-dashboard", 10, 1);
    const claimed = await store.claim({
      project: "logly-dashboard",
      owner: "tab-two",
      now: 10,
      leaseMs: 30_000,
      limit: 25,
      maxBytes: 48 * 1024,
    });

    expect(claimed.map((item) => item.eventId)).toEqual([thirdId]);
  });

  test("prevents another tab from claiming an active lease", async () => {
    const store = createMemoryEventStore();
    const id = "00000000-0000-4000-8000-000000000001";
    await store.enqueue(event(id, "2026-08-30T09:00:00.000Z"), 1, 100);
    const options = {
      project: "logly-dashboard",
      now: 10,
      leaseMs: 30,
      limit: 25,
      maxBytes: 48 * 1024,
    };

    expect(await store.claim({ ...options, owner: "tab-one" })).toHaveLength(1);
    expect(await store.claim({ ...options, owner: "tab-two" })).toHaveLength(0);
    await store.release("logly-dashboard", [id], "tab-one");
    expect(await store.claim({ ...options, owner: "tab-two" })).toHaveLength(1);
  });

  test("reports the approximate queued payload size", async () => {
    const store = createMemoryEventStore();
    const id = "00000000-0000-4000-8000-000000000001";
    await store.enqueue(event(id, "2026-08-30T09:00:00.000Z"), 1, 100);

    expect(await store.bytes("logly-dashboard")).toBeGreaterThan(256);
    expect(await store.bytes("another-project")).toBe(256);
  });
});
