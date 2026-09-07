import { describe, expect, test } from "bun:test";
import { type AnalyticsEventRow, summarizeAnalyticsEvents } from "@logly/utils";

const visit = (
  id: string,
  overrides: Partial<AnalyticsEventRow> = {},
): AnalyticsEventRow => ({
  id,
  name: "site_visit",
  project: "alpha",
  source: "browser",
  visitorKey: id,
  visitKind: "new",
  route: "/",
  referrerHost: null,
  occurredAt: "2026-09-07T10:00:00.000Z",
  properties: {},
  ...overrides,
});

describe("acquisition summaries", () => {
  test("counts visitor-day arrivals, not pageviews or server events", () => {
    const events = [
      visit("a", {
        referrerHost: "google.com",
        campaign: { source: "search" },
      }),
      visit("b", { referrerHost: "google.com" }),
      visit("c"),
      visit("d", { name: "page_view" }),
      visit("e", { source: "server" }),
      visit("f", { project: "beta" }),
      visit("g", { occurredAt: "2026-08-01T10:00:00.000Z" }),
    ];
    const summary = summarizeAnalyticsEvents(events, {
      project: "alpha",
      start: "2026-09-07T00:00:00.000Z",
    });
    expect(summary.acquisition).toEqual({
      totalVisits: 3,
      referrers: [
        { label: "google.com", count: 2 },
        { label: "Direct / unknown", count: 1 },
      ],
      campaignSources: [
        { label: "Unattributed", count: 2 },
        { label: "search", count: 1 },
      ],
    });
  });

  test("covers the entire window independently from event pagination", () => {
    const events = Array.from({ length: 251 }, (_, index) =>
      visit(String(index)),
    );
    expect(
      summarizeAnalyticsEvents(events, { project: "alpha", pageSize: 10 })
        .acquisition.totalVisits,
    ).toBe(251);
    expect(
      summarizeAnalyticsEvents(events, {
        project: "alpha",
        names: ["checkout"],
      }).acquisition.totalVisits,
    ).toBe(0);
  });

  test("empty campaign fields are unattributed and an empty window has no groups", () => {
    expect(
      summarizeAnalyticsEvents(
        [visit("a", { campaign: { source: "" }, referrerHost: "" })],
        {},
      ).acquisition.campaignSources,
    ).toEqual([{ label: "Unattributed", count: 1 }]);
    expect(summarizeAnalyticsEvents([], {}).acquisition).toEqual({
      totalVisits: 0,
      referrers: [],
      campaignSources: [],
    });
  });
});
