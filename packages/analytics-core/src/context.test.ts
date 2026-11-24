import { expect, test } from "bun:test";
import { createAnalyticsContext } from "./context";
import { analyticsGroupsSchema } from "./contracts";

test("snapshots detach metadata, override defaults and preserve prior group attribution", () => {
  const context = createAnalyticsContext();
  context.identify("opaque-user");
  const properties = { name: "First" };
  context.group("business", "opaque-first", properties);
  context.setGlobalProperties({ surface: "dashboard", role: "staff" });
  const first = context.snapshot({ role: "manager" });
  properties.name = "Changed outside SDK";
  context.group("business", "opaque-second", { name: "Second" });
  context.unsetGlobalProperties(["role"]);
  expect(first.groups?.business).toEqual({
    key: "opaque-first",
    properties: { name: "First" },
  });
  expect(first.properties).toEqual({ surface: "dashboard", role: "manager" });
  expect(context.snapshot().groups?.business?.key).toBe("opaque-second");
  context.identify("another-user");
  expect(context.snapshot()).toEqual({
    actorId: "another-user",
    groups: undefined,
    properties: {},
  });
  context.reset();
  expect(context.snapshot().actorId).toBeUndefined();
});

test("bounded group and actor validation rejects invalid changes atomically", () => {
  const context = createAnalyticsContext();
  expect(context.identify("x")).toBe(false);
  expect(context.group("Bad Type", "key")).toBe(false);
  expect(context.group("business", "x".repeat(129))).toBe(false);
  expect(context.group("business", "key", { name: "x".repeat(257) })).toBe(
    false,
  );
  for (const type of ["one", "two", "three", "four", "five"])
    expect(context.group(type, type)).toBe(true);
  expect(context.group("six", "six")).toBe(false);
  expect(Object.keys(context.snapshot().groups ?? {})).toHaveLength(5);
  expect(
    analyticsGroupsSchema.safeParse({
      business: { key: "key", properties: { nested: {} } },
    }).success,
  ).toBe(false);
});
