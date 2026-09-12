import { describe, expect, test } from "bun:test";
import { type AnalyticsConfig, createAnalyticsForTesting } from "./client";
import type { AnalyticsBatch } from "./contracts";
import { sanitizeProperties } from "./contracts";
import { createMemoryEventStore } from "./event-store";
import { createMemoryStorage } from "./visitor";

function createAnalytics(
  config: AnalyticsConfig & {
    eventStore: ReturnType<typeof createMemoryEventStore>;
  },
) {
  const { eventStore, ...publicConfig } = config;
  return createAnalyticsForTesting(publicConfig, eventStore);
}

function createIds() {
  let id = 0;
  return () => `00000000-0000-4000-8000-${String(++id).padStart(12, "0")}`;
}

function installFakeBrowser(storage: ReturnType<typeof createMemoryStorage>) {
  const documentListeners = new Map<string, EventListener>();
  const windowListeners = new Map<string, EventListener>();
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalDocument = Object.getOwnPropertyDescriptor(
    globalThis,
    "document",
  );
  const fakeDocument = {
    referrer: "",
    visibilityState: "visible",
    addEventListener: (name: string, listener: EventListener) =>
      documentListeners.set(name, listener),
    removeEventListener: (name: string) => documentListeners.delete(name),
  };
  const fakeWindow = {
    location: { href: "https://logly.test/events?token=secret" },
    localStorage: storage,
    addEventListener: (name: string, listener: EventListener) =>
      windowListeners.set(name, listener),
    removeEventListener: (name: string) => windowListeners.delete(name),
  };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: fakeWindow,
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: fakeDocument,
  });

  return {
    documentListeners,
    fakeDocument,
    windowListeners,
    restore: () => {
      if (originalWindow)
        Object.defineProperty(globalThis, "window", originalWindow);
      else Reflect.deleteProperty(globalThis, "window");
      if (originalDocument)
        Object.defineProperty(globalThis, "document", originalDocument);
      else Reflect.deleteProperty(globalThis, "document");
    },
  };
}

describe("analytics client", () => {
  test("records one visit per day and classifies a later day as returning", async () => {
    const batches: AnalyticsBatch[] = [];
    const storage = createMemoryStorage();
    const eventStore = createMemoryEventStore();
    let current = new Date("2026-08-30T09:00:00.000Z");
    const config = {
      project: "logly-dashboard",
      storage,
      eventStore,
      now: () => current,
      createId: createIds(),
      transport: async (batch: AnalyticsBatch) => {
        batches.push(batch);
      },
      flushAt: 25,
      respectPrivacySignals: false,
    };

    const first = createAnalytics(config);
    first.init();
    first.init();
    await first.flush();
    expect(batches[0]?.events).toHaveLength(1);
    expect(batches[0]?.events[0]?.visitKind).toBe("new");

    current = new Date("2026-08-31T09:00:00.000Z");
    const second = createAnalytics(config);
    second.init();
    await second.flush();
    expect(batches[1]?.events[0]?.visitKind).toBe("returning");
  });

  test("immediately sends only the first-ever visitor-day", async () => {
    const batches: AnalyticsBatch[] = [];
    const storage = createMemoryStorage();
    const eventStore = createMemoryEventStore();
    let current = new Date("2026-08-30T09:00:00.000Z");
    const base = {
      project: "logly-dashboard",
      storage,
      eventStore,
      now: () => current,
      createId: createIds(),
      transport: async (batch: AnalyticsBatch) => {
        batches.push(batch);
      },
      flushAt: 25,
      flushIntervalMs: 60_000,
      respectPrivacySignals: false,
    };

    const first = createAnalytics(base);
    first.init();
    await Bun.sleep(5);
    expect(batches).toHaveLength(1);
    expect(batches[0]?.events[0]?.visitKind).toBe("new");

    current = new Date("2026-08-31T09:00:00.000Z");
    const returning = createAnalytics(base);
    returning.init();
    await Bun.sleep(5);
    expect(batches).toHaveLength(1);

    await returning.flush();
    expect(batches).toHaveLength(2);
    expect(batches[1]?.events[0]?.visitKind).toBe("returning");
    first.destroy();
    returning.destroy();
  });

  test("retries persisted events with the same event id", async () => {
    const storage = createMemoryStorage();
    const eventStore = createMemoryEventStore();
    const ids = createIds();
    let failedEventId: string | undefined;
    const failed = createAnalytics({
      project: "logly-dashboard",
      storage,
      eventStore,
      createId: ids,
      transport: async (batch) => {
        failedEventId = batch.events[0]?.eventId;
        throw new Error("offline");
      },
      respectPrivacySignals: false,
    });

    expect(failed.track("export_clicked", { format: "json" })).toBe(true);
    await failed.flush();
    failed.destroy();

    const delivered: AnalyticsBatch[] = [];
    const recovered = createAnalytics({
      project: "logly-dashboard",
      storage,
      eventStore,
      createId: ids,
      transport: async (batch) => {
        delivered.push(batch);
      },
      respectPrivacySignals: false,
    });
    await recovered.flush();

    expect(delivered).toHaveLength(1);
    expect(delivered[0]?.events[0]?.eventId).toBe(failedEventId);
    recovered.destroy();
  });

  test("tracks page views without retaining query strings", async () => {
    const batches: AnalyticsBatch[] = [];
    const client = createAnalytics({
      project: "logly-dashboard",
      storage: createMemoryStorage(),
      eventStore: createMemoryEventStore(),
      createId: createIds(),
      transport: async (batch) => {
        batches.push(batch);
      },
      respectPrivacySignals: false,
    });

    expect(client.trackPageView({ route: "/events?token=secret" })).toBe(true);
    await client.flush();

    expect(batches[0]?.events[0]?.name).toBe("page_view");
    expect(batches[0]?.events[0]?.route).toBe("/events");
    client.destroy();
  });

  test("accepts a structurally valid custom event without an allowlist", async () => {
    const batches: AnalyticsBatch[] = [];
    const client = createAnalytics({
      project: "logly-dashboard",
      storage: createMemoryStorage(),
      eventStore: createMemoryEventStore(),
      createId: createIds(),
      transport: async (batch) => {
        batches.push(batch);
      },
      respectPrivacySignals: false,
    });

    expect(client.track("new_product_event", { safe: true })).toBe(true);
    await client.flush();
    expect(batches[0]?.events[0]?.name).toBe("new_product_event");
    expect(batches[0]?.sdk).toEqual({
      name: "@ishaqyusuf/logly-core",
      version: "0.3.0",
    });
    client.destroy();
  });

  test("flushes a full 25-event batch without waiting for the timer", async () => {
    const batches: AnalyticsBatch[] = [];
    const client = createAnalytics({
      project: "logly-dashboard",
      storage: createMemoryStorage(),
      eventStore: createMemoryEventStore(),
      createId: createIds(),
      transport: async (batch) => {
        batches.push(batch);
      },
      respectPrivacySignals: false,
    });

    for (let index = 0; index < 25; index++) {
      client.track("filter_applied", { index });
    }
    await Bun.sleep(5);

    expect(batches).toHaveLength(1);
    expect(batches[0]?.events).toHaveLength(25);
    client.destroy();
  });

  test("flushes when the queued payload reaches 48 KiB", async () => {
    const batches: AnalyticsBatch[] = [];
    const largeProperties = Object.fromEntries(
      Array.from({ length: 20 }, (_, index) => [
        `value_${index}`,
        "x".repeat(256),
      ]),
    );
    const client = createAnalytics({
      project: "logly-dashboard",
      storage: createMemoryStorage(),
      eventStore: createMemoryEventStore(),
      createId: createIds(),
      transport: async (batch) => {
        batches.push(batch);
      },
      respectPrivacySignals: false,
    });

    for (let index = 0; index < 10; index++) {
      client.track("filter_applied", largeProperties);
    }
    await Bun.sleep(10);

    expect(batches.flatMap((batch) => batch.events)).toHaveLength(10);
    client.destroy();
  });

  test("keeps events queued when the default transport receives a non-2xx response", async () => {
    const requests: AnalyticsBatch[] = [];
    const originalFetch = globalThis.fetch;
    let responseStatus = 503;
    globalThis.fetch = (async (_input, init) => {
      requests.push(JSON.parse(String(init?.body)) as AnalyticsBatch);
      return new Response(null, { status: responseStatus });
    }) as typeof fetch;

    try {
      const client = createAnalytics({
        project: "logly-dashboard",
        storage: createMemoryStorage(),
        eventStore: createMemoryEventStore(),
        createId: createIds(),
        respectPrivacySignals: false,
      });
      client.track("export_clicked", { format: "json" });
      await client.flush();
      responseStatus = 202;
      await client.flush();

      expect(requests).toHaveLength(2);
      expect(requests[1]?.events[0]?.eventId).toBe(
        requests[0]?.events[0]?.eventId,
      );
      client.destroy();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("flushes queued events on reconnect and when the document becomes hidden", async () => {
    const batches: AnalyticsBatch[] = [];
    const storage = createMemoryStorage();
    storage.setItem(
      "logly:logly-dashboard:visitor",
      JSON.stringify({
        id: "existing-visitor",
        firstSeenOn: "2026-09-01",
        lastVisitOn: "2026-09-01",
      }),
    );
    const browser = installFakeBrowser(storage);

    try {
      const client = createAnalytics({
        project: "logly-dashboard",
        storage,
        eventStore: createMemoryEventStore(),
        now: () => new Date("2026-09-01T08:00:00.000Z"),
        createId: createIds(),
        transport: async (batch) => {
          batches.push(batch);
        },
        respectPrivacySignals: false,
      });
      client.init();
      client.track("filter_applied", { source: "reconnect" });
      browser.windowListeners.get("online")?.(new Event("online"));
      await Bun.sleep(5);
      expect(batches[0]?.events[0]?.properties.source).toBe("reconnect");

      client.track("filter_applied", { source: "hidden" });
      browser.fakeDocument.visibilityState = "hidden";
      browser.documentListeners.get("visibilitychange")?.(
        new Event("visibilitychange"),
      );
      await Bun.sleep(5);
      expect(batches[1]?.events[0]?.properties.source).toBe("hidden");
      client.destroy();
    } finally {
      browser.restore();
    }
  });

  test("tracks only explicitly prefixed declarative click properties", async () => {
    const batches: AnalyticsBatch[] = [];
    const storage = createMemoryStorage();
    const browser = installFakeBrowser(storage);

    try {
      const client = createAnalytics({
        project: "logly-dashboard",
        storage,
        eventStore: createMemoryEventStore(),
        trackAttributes: true,
        createId: createIds(),
        transport: async (batch) => {
          batches.push(batch);
        },
        respectPrivacySignals: false,
      });
      client.init();
      await Bun.sleep(5);
      batches.splice(0);

      const element = {
        attributes: [
          { name: "data-logly-event", value: "export_clicked" },
          { name: "data-logly-prop-format", value: "json" },
          { name: "data-email", value: "private@example.com" },
        ],
        closest: () => element,
      };
      browser.documentListeners.get("click")?.({
        target: element,
      } as unknown as Event);
      await client.flush();

      expect(batches[0]?.events[0]?.properties).toEqual({ format: "json" });
      expect(batches[0]?.events[0]?.route).toBe("/events");
      client.destroy();
    } finally {
      browser.restore();
    }
  });

  test("drops unsupported property values and caps strings", () => {
    const result = sanitizeProperties({
      ok: true,
      nested: { no: true },
      text: "x".repeat(300),
    });
    expect(result.ok).toBe(true);
    expect(result.nested).toBeUndefined();
    expect(String(result.text)).toHaveLength(256);
  });

  test("caps referrer and campaign context before it enters the queue", async () => {
    const batches: AnalyticsBatch[] = [];
    const client = createAnalytics({
      project: "logly-dashboard",
      storage: createMemoryStorage(),
      eventStore: createMemoryEventStore(),
      createId: createIds(),
      transport: async (batch) => {
        batches.push(batch);
      },
      respectPrivacySignals: false,
    });

    client.track(
      "filter_applied",
      {},
      {
        referrerHost: "r".repeat(200),
        campaign: {
          source: "s".repeat(150),
          medium: "m".repeat(150),
          campaign: "c".repeat(150),
        },
      },
    );
    await client.flush();

    const event = batches[0]?.events[0];
    expect(event?.referrerHost).toHaveLength(160);
    expect(event?.campaign?.source).toHaveLength(100);
    expect(event?.campaign?.medium).toHaveLength(100);
    expect(event?.campaign?.campaign).toHaveLength(100);
    client.destroy();
  });
});
