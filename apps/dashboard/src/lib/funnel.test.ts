import { describe, expect, test } from "bun:test";
import {
  type AnalyticsEventRow,
  normalizeFunnelQuery,
  summarizeFunnel,
} from "@logly/utils";

const event = (
  name: string,
  time: string,
  visitorKey: string | null = "visitor-a",
  project = "alpha",
): AnalyticsEventRow => ({
  id: crypto.randomUUID(),
  name,
  occurredAt: `2026-09-07T${time}:00.000Z`,
  project,
  visitorKey,
  source: "browser",
  visitKind: null,
  route: null,
  referrerHost: null,
  properties: {},
});
const query = {
  project: "alpha",
  steps: ["visit", "checkout", "paid"],
  start: "2026-09-07T00:00:00.000Z",
  end: "2026-09-08T00:00:00.000Z",
};
describe("ordered visitor-day funnels", () => {
  test("counts each visitor once per step and requires strict chronological order", () => {
    const result = summarizeFunnel(
      [
        event("visit", "10:00"),
        event("visit", "10:01"),
        event("checkout", "10:02"),
        event("paid", "10:03"),
        event("checkout", "09:00", "b"),
        event("visit", "11:00", "b"),
        event("visit", "10:00", "c"),
        event("checkout", "10:00", "c"),
      ],
      query,
    );
    expect(result.steps.map((step) => step.visitors)).toEqual([3, 1, 1]);
    expect(result.steps[1]).toMatchObject({ conversion: 33.3, dropOff: 2 });
  });
  test("isolates projects, days, sources and missing identities", () => {
    const nextDay = {
      ...event("checkout", "11:00"),
      occurredAt: "2026-09-08T00:00:00.000Z",
    };
    expect(
      summarizeFunnel(
        [
          event("visit", "10:00"),
          nextDay,
          event("checkout", "12:00", null),
          event("checkout", "12:00", "visitor-a", "beta"),
          { ...event("checkout", "12:00"), source: "server" },
        ],
        query,
      ).steps.map((step) => step.visitors),
    ).toEqual([1, 0, 0]);
  });
  test("repeated step names require separate later events", () => {
    expect(
      summarizeFunnel([event("visit", "10:00"), event("visit", "11:00")], {
        ...query,
        steps: ["visit", "visit", "visit"],
      }).steps.map((step) => step.visitors),
    ).toEqual([1, 1, 0]);
  });
  test("rejects invalid step counts and date windows", () => {
    expect(() =>
      normalizeFunnelQuery({ ...query, steps: ["visit"] }),
    ).toThrow();
    expect(() =>
      normalizeFunnelQuery({ ...query, steps: ["visit", "bad name"] }),
    ).toThrow();
    expect(() => normalizeFunnelQuery({ ...query, start: "bad" })).toThrow();
    expect(() =>
      normalizeFunnelQuery({ ...query, start: "2020-01-01" }),
    ).toThrow();
    expect(() =>
      normalizeFunnelQuery({ ...query, start: query.end }),
    ).toThrow();
  });
});
