import { describe, expect, test } from "bun:test";
import type { AnalyticsBatch } from "@ishaqyusuf/logly-core";
import { createNativeAnalytics, sanitizeNativeRoute } from "./index";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    values,
    storage: {
      getItem: async (key: string) => values.get(key) ?? null,
      setItem: async (key: string, value: string) =>
        void values.set(key, value),
      removeItem: async (key: string) => void values.delete(key),
    },
  };
}

describe("native analytics", () => {
  test("records one daily app session with platform and release metadata", async () => {
    const { storage } = memoryStorage();
    const batches: AnalyticsBatch[] = [];
    let sequence = 0;
    let time = new Date("2026-09-12T10:00:00.000Z");
    const client = createNativeAnalytics({
      project: "gnd-mobile",
      endpoint: "https://gnd.test/api/analytics/mobile",
      platform: "android",
      appVersion: "1.4.0",
      appBuild: "104",
      storage,
      createId: () =>
        `00000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`,
      now: () => time,
      send: async (batch) => void batches.push(batch),
    });
    await client.init();
    await client.trackScreenView("/jobs/123?email=private");
    await client.trackScreenView("/jobs/456");
    await client.flush();
    expect(
      batches.flatMap((batch) => batch.events).map((event) => event.name),
    ).toEqual(["app_session", "screen_view"]);
    expect(batches[0]?.events[0]).toMatchObject({
      source: "mobile",
      platform: "android",
      appVersion: "1.4.0",
      appBuild: "104",
      route: "/jobs/:id",
    });
    time = new Date("2026-09-13T00:01:00.000Z");
    await client.trackSession("/jobs");
    await client.flush();
    expect(batches.at(-1)?.events[0]?.visitKind).toBe("returning");
    await client.destroy();
  });

  test("retains stable event IDs after a failed delivery", async () => {
    const { storage, values } = memoryStorage();
    const batches: AnalyticsBatch[] = [];
    let fail = true;
    let sequence = 0;
    const client = createNativeAnalytics({
      project: "gnd-mobile",
      endpoint: "https://gnd.test/api/analytics/mobile",
      platform: "ios",
      storage,
      createId: () =>
        `00000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`,
      send: async (batch) => {
        batches.push(batch);
        if (fail) throw new Error("offline");
      },
    });
    await client.init();
    await client.track("job_opened", { safe: true });
    await client.flush();
    const firstId = batches[0]?.events[0]?.eventId;
    expect(values.get("logly:gnd-mobile:native-queue")).toContain(firstId);
    fail = false;
    await client.flush();
    expect(batches[1]?.events[0]?.eventId).toBe(firstId);
    expect(values.has("logly:gnd-mobile:native-queue")).toBe(false);
    await client.destroy();
  });

  test("sanitizes routes without browser globals", () => {
    expect(sanitizeNativeRoute("/jobs/123?email=private")).toBe("/jobs/:id");
  });
});

test("native screen capture survives group switching during asynchronous storage and reset drops pending events", async () => {
  const { storage, values } = memoryStorage();
  const batches: AnalyticsBatch[] = [];
  let fail = true;
  const client = createNativeAnalytics({
    project: "test-project",
    endpoint: "https://test.invalid",
    platform: "android",
    storage,
    createId: () => crypto.randomUUID(),
    send: async (batch) => {
      batches.push(batch);
      if (fail) throw new Error("offline");
    },
  });
  await client.init();
  client.identify("opaque-user");
  client.group("business", "first");
  const capture = client.trackScreenView("/home");
  client.group("business", "second");
  await capture;
  await client.flush();
  const captured = JSON.parse(
    values.get("logly:test-project:native-queue") ?? "[]",
  );
  expect(captured).toHaveLength(2);
  expect(
    captured.every(
      (event: { groups: { business: { key: string } } }) =>
        event.groups.business.key === "first",
    ),
  ).toBe(true);
  await client.reset();
  fail = false;
  batches.splice(0);
  await client.track("anonymous_event");
  await client.flush();
  expect(
    batches.flatMap((batch) => batch.events).map((event) => event.name),
  ).toEqual(["anonymous_event"]);
  expect(batches[0]?.events[0]?.actorId).toBeUndefined();
  expect(batches[0]?.events[0]?.groups).toBeUndefined();
  await client.destroy();
});

test("rejects oversized Unicode events without stalling the native queue", async () => {
  const { storage } = memoryStorage();
  const batches: AnalyticsBatch[] = [];
  const client = createNativeAnalytics({
    project: "test-project",
    endpoint: "https://test.invalid",
    platform: "android",
    storage,
    createId: () => crypto.randomUUID(),
    send: async (batch) => {
      batches.push(batch);
    },
  });
  await client.init();
  const properties = Object.fromEntries(
    Array.from({ length: 20 }, (_, i) => [`p${i}`, "界".repeat(256)]),
  );
  for (const type of ["one", "two", "three", "four", "five"])
    client.group(type, "opaque", properties);
  await client.track("oversized");
  for (const type of ["one", "two", "three", "four", "five"])
    client.clearGroup(type);
  await client.track("small");
  await client.flush();
  expect(
    batches.flatMap((batch) => batch.events).map((event) => event.name),
  ).toEqual(["small"]);
  await client.destroy();
});

test("reset invalidates pending native initialization and prevents old queue restoration", async () => {
  const { storage, values } = memoryStorage();
  const oldEvent = {
    eventId: crypto.randomUUID(),
    project: "test-project",
    name: "before_logout",
    version: 1,
    source: "mobile",
    platform: "android",
    occurredAt: new Date().toISOString(),
    visitorId: "old-visitor",
    actorId: "old-user",
    properties: {},
  };
  values.set("logly:test-project:native-queue", JSON.stringify([oldEvent]));
  const reads: Array<() => void> = [];
  const batches: AnalyticsBatch[] = [];
  let pause = true;
  const client = createNativeAnalytics({
    project: "test-project",
    endpoint: "https://test.invalid",
    platform: "android",
    storage: {
      ...storage,
      getItem: (key) =>
        pause
          ? new Promise((resolve) => {
              const snapshot = values.get(key) ?? null;
              reads.push(() => resolve(snapshot));
            })
          : storage.getItem(key),
    },
    createId: () => crypto.randomUUID(),
    send: async (batch) => {
      batches.push(batch);
    },
  });
  const initializing = client.init();
  await client.reset();
  for (const resolve of reads) resolve();
  await initializing;
  await client.flush();
  expect(batches).toHaveLength(0);
  pause = false;
  await client.init();
  await client.track("after_logout");
  await client.flush();
  expect(
    batches.flatMap((batch) => batch.events).map((event) => event.name),
  ).toEqual(["after_logout"]);
  expect(batches[0]?.events[0]?.actorId).toBeUndefined();
  await client.destroy();
});
