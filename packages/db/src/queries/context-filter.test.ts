import { expect, test } from "bun:test";
import { matchesEventContext, readContextFilters } from "@logly/utils";

test("typed property equality distinguishes missing, null, strings and numbers", () => {
  const event = {
    properties: { count: 3, nil: null, active: false },
    groups: { business: { key: "opaque-a", properties: { name: "Shop A" } } },
  };
  expect(
    matchesEventContext(event, { propertyKey: "count", propertyValue: "3" }),
  ).toBe(true);
  expect(
    matchesEventContext(event, { propertyKey: "count", propertyValue: '"3"' }),
  ).toBe(false);
  expect(
    matchesEventContext(event, {
      propertyKey: "absent",
      propertyValue: "null",
    }),
  ).toBe(false);
  expect(
    matchesEventContext(event, { propertyKey: "nil", propertyValue: "null" }),
  ).toBe(true);
  expect(
    matchesEventContext(event, {
      propertyKey: "active",
      propertyValue: "false",
    }),
  ).toBe(true);
  expect(
    matchesEventContext(event, { groupType: "business", groupKey: "opaque-b" }),
  ).toBe(false);
  expect(
    matchesEventContext(event, { groupType: "business", groupKey: "opaque-a" }),
  ).toBe(true);
});

test("invalid filter scope fails closed rather than broadening results", () => {
  for (const value of [
    "groupKey=x",
    "groupType=bad-name",
    "propertyKey=count",
    "propertyKey=x&propertyValue=%7B%7D",
  ]) {
    expect(() => readContextFilters(new URLSearchParams(value))).toThrow();
  }
  expect(
    readContextFilters(
      new URLSearchParams("propertyKey=count&propertyValue=3"),
    ),
  ).toEqual({ propertyKey: "count", propertyValue: "3" });
});
