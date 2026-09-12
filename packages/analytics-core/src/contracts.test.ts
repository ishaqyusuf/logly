import { describe, expect, test } from "bun:test";
import { analyticsEventSchema, isSystemEventName } from "./contracts";

const event = {
  eventId: "00000000-0000-4000-8000-000000000001",
  project: "gnd-mobile",
  name: "app_session",
  version: 1,
  occurredAt: "2026-09-12T12:00:00.000Z",
  visitorId: "installation-1",
  properties: {},
};

describe("mobile analytics contract", () => {
  test("accepts bounded Android and iOS metadata", () => {
    for (const platform of ["android", "ios"] as const) {
      expect(
        analyticsEventSchema.parse({
          ...event,
          source: "mobile",
          platform,
          appVersion: "1.4.0",
          appBuild: "104",
        }),
      ).toMatchObject({ source: "mobile", platform });
    }
  });

  test("rejects mobile events without a native platform", () => {
    expect(
      analyticsEventSchema.safeParse({ ...event, source: "mobile" }).success,
    ).toBe(false);
    expect(
      analyticsEventSchema.safeParse({
        ...event,
        source: "browser",
        platform: "ios",
      }).success,
    ).toBe(false);
  });

  test("reserves native lifecycle events", () => {
    expect(isSystemEventName("app_session")).toBe(true);
    expect(isSystemEventName("screen_view")).toBe(true);
  });
});
