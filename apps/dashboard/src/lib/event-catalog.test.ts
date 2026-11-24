import { describe, expect, test } from "bun:test";
import {
  type AnalyticsEventRow,
  EVENT_CATALOG_MAX_EVENTS,
  findSimilarEventNames,
  parseEventCatalogInput,
  similarEventReason,
  summarizeEventCatalog,
  visibleEventNames,
} from "@logly/utils";

const now = new Date("2026-11-24T12:00:00.000Z");
let id = 0;
function event(
  name: string,
  hoursAgo: number,
  extra: Partial<AnalyticsEventRow> = {},
): AnalyticsEventRow {
  id++;
  return {
    id: `e${String(id).padStart(5, "0")}`,
    name,
    project: "gnd",
    source: "browser",
    visitorKey: "v1",
    visitKind: null,
    route: null,
    referrerHost: null,
    occurredAt: new Date(now.getTime() - hoursAgo * 3_600_000).toISOString(),
    properties: {},
    ...extra,
  };
}

describe("likely duplicates", () => {
  test("flags separators, word order, suffixes and one-letter typos", () => {
    expect(similarEventReason("quote_opened", "quoteopened")).toBe(
      "separators",
    );
    expect(similarEventReason("quote_opened", "quote.opened")).toBe(
      "separators",
    );
    expect(similarEventReason("quote_opened", "opened_quote")).toBe(
      "word_order",
    );
    expect(similarEventReason("quote_open", "quote_opened")).toBe("suffix");
    expect(similarEventReason("page_view", "page_views")).toBe("suffix");
    expect(similarEventReason("qoute_opened", "quote_opened")).toBe("typo");
    expect(similarEventReason("sign_up", "signup")).toBe("separators");
  });

  test("leaves distinct names alone", () => {
    expect(similarEventReason("quote_opened", "quote_closed")).toBeNull();
    expect(similarEventReason("step_1", "step_2")).toBeNull();
    expect(similarEventReason("page_view", "screen_view")).toBeNull();
    expect(similarEventReason("app_session", "site_visit")).toBeNull();
    expect(similarEventReason("job_opened", "job_opened")).toBeNull();
    // Too short to call a one-letter change a typo.
    expect(similarEventReason("buy", "bay")).toBeNull();
  });

  test("groups every pair both ways", () => {
    const similar = findSimilarEventNames([
      "quote_opened",
      "quoteopened",
      "quote_open",
      "page_view",
    ]);
    expect(similar.get("quote_opened")?.map((row) => row.name)).toEqual([
      "quote_open",
      "quoteopened",
    ]);
    expect(similar.get("quote_open")?.map((row) => row.name)).toEqual([
      "quote_opened",
      "quoteopened",
    ]);
    expect(similar.has("page_view")).toBe(false);
  });
});

describe("summarizeEventCatalog", () => {
  const events = [
    event("quote_opened", 1, {
      source: "mobile",
      properties: { quote_id: "q1", channel: "app" },
    }),
    event("quote_opened", 30, { properties: { quote_id: "q2" } }),
    event("quote_opened", 24 * 9, { source: "server" }),
    event("quote_open", 24 * 20),
    event("quote_open", 24 * 40),
    event("page_view", 0, { properties: { "Bad Key": 1, path: "/" } }),
    event("page_view", 24 * 7 - 0.5),
    event("other_project", 1, { project: "plot-keys" }),
  ];

  test("first/last seen, range volume, previous period and trend", () => {
    const catalog = summarizeEventCatalog(
      events,
      { project: "gnd", range: "7d", staleDays: 14 },
      [],
      now,
    );
    expect(catalog.events.map((row) => row.name)).toEqual([
      "page_view",
      "quote_opened",
      "quote_open",
    ]);
    const opened = catalog.events.find((row) => row.name === "quote_opened");
    expect(opened).toMatchObject({
      count: 2,
      previousCount: 1,
      sources: ["browser", "mobile", "server"],
      properties: ["channel", "quote_id"],
      status: "active",
      firstSeen: events[2]?.occurredAt,
      lastSeen: events[0]?.occurredAt,
    });
    expect(opened?.trend).toEqual([0, 0, 0, 0, 0, 1, 1]);
    const pageView = catalog.events.find((row) => row.name === "page_view");
    // The event at "now" folds into the last bucket; bad keys are dropped.
    expect(pageView?.trend).toEqual([1, 0, 0, 0, 0, 0, 1]);
    expect(pageView?.properties).toEqual(["path"]);
    const open = catalog.events.find((row) => row.name === "quote_open");
    expect(open).toMatchObject({ count: 0, previousCount: 0, status: "stale" });
    expect(open?.similar).toEqual([{ name: "quote_opened", reason: "suffix" }]);
    expect(catalog.truncated).toBe(false);
  });

  test("the stale threshold and metadata-only names", () => {
    const catalog = summarizeEventCatalog(
      events,
      { project: "gnd", range: "24h", staleDays: 30 },
      [
        {
          name: "quote_open",
          description: "Old name",
          notes: "Sales",
          deprecated: true,
          hidden: true,
          updatedAt: now.toISOString(),
        },
        {
          name: "legacy_event",
          description: "",
          notes: "",
          deprecated: true,
          hidden: false,
          updatedAt: now.toISOString(),
        },
      ],
      now,
    );
    const open = catalog.events.find((row) => row.name === "quote_open");
    expect(open).toMatchObject({
      status: "active",
      description: "Old name",
      deprecated: true,
      hidden: true,
    });
    const legacy = catalog.events.find((row) => row.name === "legacy_event");
    expect(legacy).toMatchObject({
      status: "stale",
      firstSeen: null,
      lastSeen: null,
      count: 0,
    });
    expect(legacy?.trend).toHaveLength(24);
  });

  test("caps the number of names", () => {
    const many = Array.from({ length: EVENT_CATALOG_MAX_EVENTS + 3 }, (_, i) =>
      event(`event_${String(i).padStart(4, "0")}`, 1),
    );
    const catalog = summarizeEventCatalog(
      many,
      { project: "gnd", range: "7d", staleDays: 14 },
      [],
      now,
    );
    expect(catalog.events).toHaveLength(EVENT_CATALOG_MAX_EVENTS);
    expect(catalog.truncated).toBe(true);
  });
});

describe("pickers and input", () => {
  test("hidden names drop out unless currently selected", () => {
    const flags = { deprecated: ["b"], hidden: ["c", "d"] };
    expect(visibleEventNames(["a", "b", "c", "d"], flags)).toEqual(["a", "b"]);
    expect(visibleEventNames(["a", "c", "d"], flags, ["d"])).toEqual([
      "a",
      "d",
    ]);
    expect(visibleEventNames(["a"], undefined)).toEqual(["a"]);
  });

  test("parses and trims metadata input", () => {
    expect(
      parseEventCatalogInput({
        project: "gnd",
        name: "quote_open",
        description: " Old\u0007 name ",
      }),
    ).toEqual({
      ok: true,
      data: {
        project: "gnd",
        name: "quote_open",
        description: "Old name",
        notes: "",
        deprecated: false,
        hidden: false,
      },
    });
    expect(parseEventCatalogInput([]).ok).toBe(false);
    expect(
      parseEventCatalogInput({ project: "gnd", name: "QuoteOpened" }).ok,
    ).toBe(false);
  });
});
