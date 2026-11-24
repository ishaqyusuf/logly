import { describe, expect, test } from "bun:test";
import {
  type AnalyticsEventRow,
  choosePageViewEvent,
  pagesReportWindow,
  summarizePages,
} from "@logly/utils";

const now = new Date("2026-11-24T12:00:00Z");
let id = 0;
const view = (
  route: string | null,
  visitor: string | null,
  at: string,
  name = "page_view",
  project = "web",
): AnalyticsEventRow => ({
  id: `e${++id}`,
  name,
  project,
  source: name === "screen_view" ? "mobile" : "browser",
  visitorKey: visitor,
  visitKind: null,
  route,
  referrerHost: null,
  occurredAt: at,
  properties: {},
});

const events = [
  // Current 24h window: 2026-11-23T12:00Z .. 2026-11-24T12:00Z
  view("/", "a", "2026-11-24T08:00:00.000Z"),
  view("/orders/:id", "a", "2026-11-24T08:05:00.000Z"),
  view("/orders/:id", "a", "2026-11-24T08:10:00.000Z"),
  view("/", "b", "2026-11-24T09:00:00.000Z"),
  view("/other", "b", "2026-11-24T09:01:00.000Z"),
  view("/orders/123", "c", "2026-11-24T10:00:00.000Z"), // pre-template path
  view(null, "c", "2026-11-24T10:01:00.000Z"),
  // Previous 24h window
  view("/", "a", "2026-11-23T08:00:00.000Z"),
  view("/orders/:id", "d", "2026-11-23T09:00:00.000Z"),
  // Out of scope: another project, another event, outside both windows
  view("/", "z", "2026-11-24T08:00:00.000Z", "page_view", "other"),
  view("/", "z", "2026-11-24T08:00:00.000Z", "cta_clicked"),
  view("/", "z", "2026-11-20T08:00:00.000Z"),
  view("Home", "m", "2026-11-24T07:00:00.000Z", "screen_view"),
];

describe("pages report", () => {
  test("window matches the Pulse rolling range and previous window", () => {
    const window = pagesReportWindow("7d", now);
    expect(window.start.toISOString()).toBe("2026-11-17T12:00:00.000Z");
    expect(window.previousStart.toISOString()).toBe("2026-11-10T12:00:00.000Z");
  });

  test("defaults to page_view and falls back to screen_view for mobile", () => {
    expect(choosePageViewEvent({ page_view: 0, screen_view: 0 })).toBe(
      "page_view",
    );
    expect(choosePageViewEvent({ page_view: 0, screen_view: 4 })).toBe(
      "screen_view",
    );
    expect(
      choosePageViewEvent({ page_view: 9, screen_view: 4 }, "screen_view"),
    ).toBe("screen_view");
  });

  test("top pages, totals and previous-period counts", () => {
    const report = summarizePages(events, {
      project: "web",
      range: "24h",
      now,
    });
    expect(report.view).toBe("page_view");
    expect(report.available).toEqual({ page_view: 7, screen_view: 1 });
    expect(report.totals).toEqual({
      views: 7,
      visitors: 3,
      previousViews: 2,
      previousVisitors: 2,
      visitorDays: 3,
    });
    expect(report.pages[0]).toEqual({
      route: "/",
      views: 2,
      visitors: 2,
      previousViews: 1,
      previousVisitors: 1,
    });
    // Raw paths, /other and null routes are shown as recorded.
    expect(report.pages.map((page) => page.route)).toContain("/orders/123");
    expect(report.pages.map((page) => page.route)).toContain(null);
    expect(report.pages.map((page) => page.route)).toContain("/other");
  });

  test("entry and exit pages per visitor-day", () => {
    const report = summarizePages(events, {
      project: "web",
      range: "24h",
      now,
    });
    expect(report.entries).toEqual([
      { route: "/", count: 2 },
      { route: "/orders/123", count: 1 },
    ]);
    expect(report.exits.map((row) => row.route).sort()).toEqual(
      ["/orders/:id", "/other", "null"]
        .map((r) => (r === "null" ? null : r))
        .sort(),
    );
  });

  test("mobile projects report screen_view", () => {
    const report = summarizePages(events, {
      project: "web",
      range: "24h",
      view: "screen_view",
      now,
    });
    expect(report.pages).toEqual([
      {
        route: "Home",
        views: 1,
        visitors: 1,
        previousViews: 0,
        previousVisitors: 0,
      },
    ]);
  });
});
