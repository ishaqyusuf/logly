import { expect, test } from "bun:test";
import {
  BreakdownQueryError,
  breakdownDays,
  parseBreakdownQuery,
} from "@logly/utils";

const base =
  "project=ewatrade-dashboard&start=2026-11-01T00:00:00Z&end=2026-11-08T00:00:00Z";
const parse = (params: string) =>
  parseBreakdownQuery(new URLSearchParams(`${base}&${params}`));

test("parses a full breakdown request with defaults", () => {
  expect(parse("by=name")).toEqual({
    project: "ewatrade-dashboard",
    organization: undefined,
    start: "2026-11-01T00:00:00.000Z",
    end: "2026-11-08T00:00:00.000Z",
    names: undefined,
    sources: undefined,
    platforms: undefined,
    actor: undefined,
    groupType: undefined,
    groupKey: undefined,
    propertyKey: undefined,
    propertyValue: undefined,
    by: ["name"],
    metrics: ["events"],
    metricGroupType: "business",
    interval: undefined,
    limit: 10,
    durationProperty: undefined,
  });
  expect(
    parse(
      "by=name,property:assistant_channel&metrics=events,actors,groups&interval=day&limit=20&durationProperty=duration_ms&names=a,b&sources=server&platforms=web&groupType=business&groupKey=k&propertyKey=assistant_channel&propertyValue=%22telegram%22",
    ),
  ).toMatchObject({
    by: ["name", "property:assistant_channel"],
    metrics: ["events", "actors", "groups"],
    interval: "day",
    limit: 20,
    durationProperty: "duration_ms",
    names: ["a", "b"],
    propertyValue: "telegram",
  });
});

test("rejects invalid input instead of broadening results", () => {
  const invalid = [
    "", // by missing
    "by=",
    "by=country",
    "by=name,source,platform",
    "by=property:Assistant-Channel",
    "by=property:",
    "by=name&metrics=visitors",
    "by=name&limit=0",
    "by=name&limit=21",
    "by=name&limit=2.5",
    "by=name&interval=week",
    "by=name&durationProperty=duration-ms",
    "by=name&sources=desktop",
    "by=name&platforms=windows",
    "by=name&actor=raw-account-id",
    "by=name&groupKey=k",
    "by=name&groupType=bad-type",
    "by=name&propertyKey=x",
    "by=name&propertyValue=1",
    "by=name&propertyKey=x&propertyValue=%7B%7D",
    "by=name&propertyKey=x&propertyValue=not-json",
    "by=name&metricGroupType=Bad",
    "by=name&names=a,,b",
  ];
  for (const params of invalid)
    expect(() => parse(params), params).toThrow(BreakdownQueryError);

  const window = (start: string, end: string) => () =>
    parseBreakdownQuery(
      new URLSearchParams(`project=p&by=name&start=${start}&end=${end}`),
    );
  expect(window("2026-11-02T00:00:00Z", "2026-11-01T00:00:00Z")).toThrow(
    "end must be after start",
  );
  expect(window("2025-01-01T00:00:00Z", "2026-11-01T00:00:00Z")).toThrow(
    "366 days",
  );
  expect(window("2026-11-01", "2026-11-02T00:00:00Z")).toThrow(
    BreakdownQueryError,
  );
  expect(() => parseBreakdownQuery(new URLSearchParams("by=name"))).toThrow(
    "Project is required",
  );
  // Series output is bounded: days × (limit + 2)^dimensions.
  expect(() =>
    parseBreakdownQuery(
      new URLSearchParams(
        "project=p&by=name,source&limit=20&interval=day&start=2026-01-01T00:00:00Z&end=2026-12-31T00:00:00Z",
      ),
    ),
  ).toThrow("too large");
});

test("UTC days cover the half-open window", () => {
  expect(
    breakdownDays(
      new Date("2026-11-01T12:00:00Z"),
      new Date("2026-11-03T00:00:00Z"),
    ),
  ).toEqual(["2026-11-01", "2026-11-02"]);
  expect(
    breakdownDays(
      new Date("2026-11-01T00:00:00Z"),
      new Date("2026-11-03T00:00:01Z"),
    ),
  ).toEqual(["2026-11-01", "2026-11-02", "2026-11-03"]);
});
