import { expect, test } from "bun:test";
import {
  type AnalyticsEventRow,
  normalizeCountry,
  summarizeAnalyticsEvents,
  summarizeCountries,
} from "@logly/utils";

test("country codes normalize and non-country values remain unknown", () => {
  expect(normalizeCountry(" ng ")).toBe("NG");
  for (const value of [
    undefined,
    null,
    "XX",
    "ZZ",
    "EU",
    "USA",
    "1A",
    "",
    "Nigeria",
  ])
    expect(normalizeCountry(value)).toBeNull();
  const result = summarizeCountries([
    { country: "ng", count: 20 },
    { country: "NG", count: 5 },
    { country: "US", count: 10 },
    { country: null, count: 3 },
    { country: "ZZ", count: 2 },
  ]);
  expect(result).toEqual({
    totalVisits: 40,
    unknownVisits: 5,
    countries: [
      { code: "NG", name: "Nigeria", count: 25 },
      { code: "US", name: "United States", count: 10 },
    ],
  });
});
test("country summary excludes pageviews, server events and foreign project/date", () => {
  const event: AnalyticsEventRow = {
    id: "1",
    project: "alpha",
    name: "site_visit",
    source: "browser",
    platform: "web",
    appVersion: null,
    appBuild: null,
    visitorKey: "visitor",
    visitKind: "new",
    route: "/",
    referrerHost: null,
    country: "NG",
    occurredAt: "2026-09-07T12:00:00Z",
    properties: {},
  };
  const result = summarizeAnalyticsEvents(
    [
      event,
      { ...event, id: "2", name: "page_view" },
      { ...event, id: "3", source: "server", platform: null },
      { ...event, id: "4", project: "beta" },
      { ...event, id: "5", occurredAt: "2026-08-01T00:00:00Z" },
    ],
    {
      project: "alpha",
      start: "2026-09-07T00:00:00Z",
      end: "2026-09-08T00:00:00Z",
    },
  );
  expect(result.geography.totalVisits).toBe(1);
  expect(result.geography.countries[0]?.code).toBe("NG");
  expect(summarizeCountries([])).toEqual({
    totalVisits: 0,
    unknownVisits: 0,
    countries: [],
  });
});

test("country summary includes native app sessions and excludes screen views", () => {
  const session: AnalyticsEventRow = {
    id: "mobile-1",
    project: "gnd-mobile",
    name: "app_session",
    source: "mobile",
    platform: "android",
    appVersion: "1.0.0",
    appBuild: "1",
    visitorKey: "installation",
    visitKind: "new",
    route: "/jobs",
    referrerHost: null,
    country: "US",
    occurredAt: "2026-09-12T12:00:00Z",
    properties: {},
  };
  const result = summarizeAnalyticsEvents(
    [session, { ...session, id: "mobile-2", name: "screen_view" }],
    { project: "gnd-mobile" },
  );
  expect(result.geography).toEqual({
    totalVisits: 1,
    unknownVisits: 0,
    countries: [{ code: "US", name: "United States", count: 1 }],
  });
});
