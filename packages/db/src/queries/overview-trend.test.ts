import { describe, expect, test } from "bun:test";
import {
  fillTrendBuckets,
  overviewTrendGranularity,
  trendBucketKeys,
} from "./overview-trend";

describe("overview trend buckets", () => {
  test("uses hourly buckets only for the 24-hour range", () => {
    expect(overviewTrendGranularity("24h")).toBe("hour");
    expect(overviewTrendGranularity("7d")).toBe("day");
    expect(overviewTrendGranularity("30d")).toBe("day");
    expect(overviewTrendGranularity()).toBe("day");
  });

  test("lists UTC hour keys from the start bucket through the end bucket", () => {
    const keys = trendBucketKeys(
      new Date("2026-11-12T11:20:00Z"),
      new Date("2026-11-13T11:20:00Z"),
      "hour",
    );
    expect(keys).toHaveLength(25);
    expect(keys[0]).toBe("2026-11-12T11:00:00Z");
    expect(keys.at(-1)).toBe("2026-11-13T11:00:00Z");
  });

  test("current and previous day windows produce index-aligned bucket counts", () => {
    const now = new Date("2026-11-13T11:20:00Z");
    const start = new Date(now.getTime() - 168 * 3_600_000);
    const previousStart = new Date(start.getTime() - 168 * 3_600_000);
    const current = trendBucketKeys(start, now, "day");
    const previous = trendBucketKeys(
      previousStart,
      new Date(start.getTime() - 1),
      "day",
    );
    expect(current[0]).toBe("2026-11-06");
    expect(current.at(-1)).toBe("2026-11-13");
    expect(previous).toHaveLength(current.length);
  });

  test("zero-fills missing buckets and keeps visitor-kind counts", () => {
    const filled = fillTrendBuckets(
      [
        {
          date: "2026-11-12",
          events: 9,
          visitors: 4,
          newVisitors: 2,
          returningVisitors: 1,
        },
      ],
      ["2026-11-11", "2026-11-12"],
    );
    expect(filled).toEqual([
      {
        date: "2026-11-11",
        events: 0,
        visitors: 0,
        newVisitors: 0,
        returningVisitors: 0,
      },
      {
        date: "2026-11-12",
        events: 9,
        visitors: 4,
        newVisitors: 2,
        returningVisitors: 1,
      },
    ]);
  });
});
