import { describe, expect, test } from "bun:test";
import {
  type AnalyticsEventRow,
  APP_VERSIONS_TOP_N,
  appVersionsBuckets,
  compareAppVersions,
  summarizeAppVersions,
} from "@logly/utils";

const now = new Date("2026-11-24T12:00:00Z");
let id = 0;
const event = (
  visitor: string | null,
  version: string | null,
  at: string,
  extra: Partial<AnalyticsEventRow> = {},
): AnalyticsEventRow => ({
  id: `e${String(++id).padStart(4, "0")}`,
  name: "app_session",
  project: "app",
  source: "mobile",
  platform: "android",
  appVersion: version,
  appBuild: version ? `${version.replaceAll(".", "")}0` : null,
  visitorKey: visitor,
  visitKind: null,
  route: null,
  referrerHost: null,
  occurredAt: at,
  properties: {},
  ...extra,
});

describe("compareAppVersions", () => {
  test("sorts numerically, not as strings", () => {
    const sorted = [
      "1.10.0",
      "1.9.0",
      "1.2",
      "1.2.1",
      "v2.0.0",
      "1.10.0-beta.2",
      "1.10.0-beta.10",
    ].sort(compareAppVersions);
    expect(sorted).toEqual([
      "1.2",
      "1.2.1",
      "1.9.0",
      "1.10.0-beta.2",
      "1.10.0-beta.10",
      "1.10.0",
      "v2.0.0",
    ]);
  });
  test("treats missing parts as zero and ignores build metadata", () => {
    expect(compareAppVersions("1.2", "1.2.0")).toBeLessThanOrEqual(0);
    expect(compareAppVersions("1.2.0+5", "1.2.0+9")).not.toBeGreaterThan(0);
    expect(compareAppVersions("1.3.0+1", "1.2.9+99")).toBe(1);
  });
});

describe("summarizeAppVersions", () => {
  const events = [
    // a upgrades 1.9.0 -> 1.10.0 in range; counted once, on 1.10.0.
    event("a", "1.9.0", "2026-11-24T01:00:00Z"),
    event("a", "1.10.0", "2026-11-24T05:00:00Z"),
    event("b", "1.9.0", "2026-11-24T06:00:00Z", {
      platform: "ios",
      appBuild: "77",
    }),
    event("c", null, "2026-11-24T07:00:00Z"),
    event("d", " ", "2026-11-24T08:00:00Z"), // blank version is unknown
    event(null, "1.10.0", "2026-11-24T09:00:00Z"), // no visitor: events only
    // first seen before the range
    event("z", "1.9.0", "2026-10-01T00:00:00Z"),
    // other projects and web events are ignored
    event("x", "9.9.9", "2026-11-24T09:00:00Z", { project: "other" }),
    event("y", "9.9.9", "2026-11-24T09:00:00Z", {
      source: "browser",
      platform: "web",
    }),
  ];
  const report = summarizeAppVersions(events, {
    project: "app",
    range: "24h",
    now,
  });

  test("attributes each visitor to their latest version", () => {
    expect(report.mobile).toBe(true);
    expect(report.totals).toEqual({
      activeUsers: 4,
      events: 6,
      unknownUsers: 2,
      versions: 2,
    });
    expect(report.latestVersion).toBe("1.10.0");
    expect(
      report.versions.map((row) => [
        row.label,
        row.activeUsers,
        row.currentUsers,
        row.currentShare,
      ]),
    ).toEqual([
      ["1.10.0", 1, 1, 0.25],
      ["1.9.0", 2, 1, 0.25],
      ["Unknown", 2, 2, 0.5],
    ]);
    const old = report.versions[1];
    expect(old?.firstSeen).toBe("2026-10-01T00:00:00.000Z");
    expect(old?.lastSeen).toBe("2026-11-24T06:00:00.000Z");
    expect(old?.events).toBe(2);
    expect(old?.builds).toEqual([{ build: "77", users: 1 }]);
    expect(old?.platforms).toEqual({ ios: 1, android: 0, unknown: 0 });
    expect(report.versions[0]?.latest).toBe(true);
  });

  test("hourly trend buckets sum to the bucket's visitors", () => {
    expect(report.granularity).toBe("hour");
    expect(report.trend).toHaveLength(24);
    const at5 = report.trend.find(
      (point) => point.bucket === "2026-11-24T05:00:00.000Z",
    );
    expect(at5?.values).toEqual({ v0: 1, v1: 0, unknown: 0 });
    expect(report.trend.reduce((sum, point) => sum + point.total, 0)).toBe(5);
  });

  test("breaks down by platform", () => {
    expect(report.platforms.map((row) => [row.platform, row.users])).toEqual([
      ["ios", 1],
      ["android", 3],
    ]);
  });

  test("folds versions beyond the top N into other", () => {
    const many = Array.from({ length: APP_VERSIONS_TOP_N + 3 }, (_, index) =>
      event(`m${index}`, `1.${index}.0`, "2026-11-24T10:00:00Z"),
    );
    const folded = summarizeAppVersions(many, {
      project: "app",
      range: "7d",
      now,
    });
    expect(folded.series).toHaveLength(APP_VERSIONS_TOP_N + 1);
    const other = folded.versions.at(-1);
    expect(other?.kind).toBe("other");
    expect(other?.versionCount).toBe(3);
    expect(other?.currentUsers).toBe(3);
    expect(other?.activeUsers).toBeNull();
    expect(folded.versions[0]?.label).toBe(`1.${APP_VERSIONS_TOP_N + 2}.0`);
    expect(folded.trend).toHaveLength(8);
  });

  test("web-only projects are not mobile", () => {
    const web = summarizeAppVersions(
      [
        event("y", null, "2026-11-24T09:00:00Z", {
          source: "browser",
          platform: "web",
        }),
      ],
      { project: "app", range: "7d", now },
    );
    expect(web.mobile).toBe(false);
    expect(web.versions).toEqual([]);
  });

  test("bucket list covers the window", () => {
    expect(
      appVersionsBuckets(new Date("2026-11-17T12:00:00Z"), now, "day").at(0),
    ).toBe("2026-11-17T00:00:00.000Z");
  });
});
