import { describe, expect, test } from "bun:test";
import { type AnalyticsEventRow, summarizeAnalyticsEvents } from "@logly/utils";

function event(
  id: string,
  name: string,
  project: string,
  occurredAt: string,
): AnalyticsEventRow {
  return {
    id,
    name,
    project,
    occurredAt,
    source: "browser",
    visitorKey: id,
    visitKind: "new",
    route: "/",
    referrerHost: null,
    properties: {},
  };
}

describe("summarizeAnalyticsEvents", () => {
  test("keeps totals, names, and momentum inside one project and filter window", () => {
    const events = [
      event("1", "checkout", "alpha", "2026-09-04T10:00:00.000Z"),
      event("2", "checkout", "alpha", "2026-09-04T11:00:00.000Z"),
      event("3", "visit", "alpha", "2026-09-04T12:00:00.000Z"),
      event("4", "checkout", "alpha", "2026-09-03T12:00:00.000Z"),
      event("5", "checkout", "beta", "2026-09-04T12:00:00.000Z"),
    ];
    const summary = summarizeAnalyticsEvents(events, {
      project: "alpha",
      start: "2026-09-04T00:00:00.000Z",
      end: "2026-09-04T23:59:59.999Z",
    });
    expect(summary.totalEvents).toBe(3);
    expect(summary.uniqueEventNames).toBe(2);
    expect(summary.eventNames[0]).toMatchObject({
      name: "checkout",
      count: 2,
      previousCount: 1,
      change: 100,
    });
    expect(summary.routes).toEqual([{ route: "/", count: 3 }]);
  });
});
