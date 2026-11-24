import { describe, expect, test } from "bun:test";
import {
  type AnalyticsEventRow,
  FUNNEL_OTHER,
  normalizeFunnelQuery,
  parseFunnelStepsParam,
  serializeFunnelSteps,
  summarizeFunnel,
} from "@logly/utils";

const event = (
  name: string,
  time: string,
  visitorKey: string | null = "visitor-a",
  extra: Partial<AnalyticsEventRow> = {},
): AnalyticsEventRow => ({
  id: crypto.randomUUID(),
  name,
  occurredAt: time.includes("T") ? time : `2026-09-07T${time}:00.000Z`,
  project: "alpha",
  visitorKey,
  source: "browser",
  visitKind: null,
  route: null,
  referrerHost: null,
  properties: {},
  ...extra,
});
const query = {
  project: "alpha",
  steps: ["visit", "checkout", "paid"],
  start: "2026-09-01T00:00:00.000Z",
  end: "2026-09-10T00:00:00.000Z",
};
const visitors = (result: ReturnType<typeof summarizeFunnel>) =>
  result.steps.map((step) => step.visitors);

describe("ordered visitor funnels", () => {
  test("counts each visitor once per step in strict chronological order", () => {
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
    expect(visitors(result)).toEqual([3, 1, 1]);
    expect(result.steps[1]).toMatchObject({
      conversion: 33.3,
      stepConversion: 33.3,
      dropOff: 2,
      medianSeconds: 120,
    });
    expect(result.steps[2]).toMatchObject({
      conversion: 33.3,
      stepConversion: 100,
      medianSeconds: 60,
    });
    expect(result.steps[0]).toMatchObject({ stepConversion: 100, dropOff: 0 });
  });

  test("measures the conversion window from entry, across days", () => {
    const events = [
      event("visit", "2026-09-07T23:30:00.000Z"),
      event("checkout", "2026-09-08T00:10:00.000Z"),
      event("paid", "2026-09-08T23:31:00.000Z"),
    ];
    expect(
      visitors(summarizeFunnel(events, { ...query, window: "1h" })),
    ).toEqual([1, 1, 0]);
    expect(
      visitors(summarizeFunnel(events, { ...query, window: "1d" })),
    ).toEqual([1, 1, 0]);
    expect(
      visitors(summarizeFunnel(events, { ...query, window: "7d" })),
    ).toEqual([1, 1, 1]);
  });

  test("enters on the earliest step-1 event only", () => {
    // The first visit has no checkout inside an hour; the second would, but
    // a visitor enters once per range.
    expect(
      visitors(
        summarizeFunnel(
          [
            event("visit", "08:00"),
            event("visit", "10:00"),
            event("checkout", "10:05"),
          ],
          { ...query, steps: ["visit", "checkout"], window: "1h" },
        ),
      ),
    ).toEqual([1, 0]);
  });

  test("includes every source with a visitor key and isolates projects", () => {
    expect(
      visitors(
        summarizeFunnel(
          [
            event("visit", "10:00"),
            event("checkout", "11:00", "visitor-a", { source: "server" }),
            event("paid", "12:00", null),
            event("paid", "12:00", "visitor-a", { project: "beta" }),
            event("paid", "2026-09-11T00:00:00.000Z"),
          ],
          query,
        ),
      ),
    ).toEqual([1, 1, 0]);
  });

  test("repeated step names require separate later events", () => {
    expect(
      visitors(
        summarizeFunnel([event("visit", "10:00"), event("visit", "11:00")], {
          ...query,
          steps: ["visit", "visit", "visit"],
        }),
      ),
    ).toEqual([1, 1, 0]);
  });

  test("applies route and property filters per step", () => {
    const steps = [
      { event: "page_view", route: "/quotes/:id" },
      { event: "quote_edited" },
      { event: "quote_accepted", property: { key: "channel", value: "email" } },
    ];
    const result = summarizeFunnel(
      [
        event("page_view", "10:00", "a", { route: "/quotes/:id" }),
        event("quote_edited", "10:01", "a"),
        event("quote_accepted", "10:02", "a", {
          properties: { channel: "sms" },
        }),
        event("quote_accepted", "10:03", "a", {
          properties: { channel: "email" },
        }),
        event("page_view", "10:00", "b", { route: "/orders/:id" }),
        event("quote_edited", "10:01", "b"),
      ],
      { ...query, steps },
    );
    expect(visitors(result)).toEqual([1, 1, 1]);
    expect(result.steps[0]).toMatchObject({ route: "/quotes/:id" });
  });

  test("breaks down by the entry event's dimension and folds extras", () => {
    const events: AnalyticsEventRow[] = [];
    const countries = ["NG", "NG", "US", "GB", "CA", "DE", "FR", null];
    countries.forEach((country, index) => {
      events.push(event("visit", "10:00", `v${index}`, { country }));
      if (index % 2 === 0)
        events.push(event("checkout", "10:30", `v${index}`, { country: "ZZ" }));
    });
    const result = summarizeFunnel(events, {
      ...query,
      steps: ["visit", "checkout"],
      breakdown: "country",
    });
    expect(result.breakdown).toBe("country");
    expect(result.segments[0]).toEqual({ value: "NG", counts: [2, 1] });
    expect(result.segments).toHaveLength(6);
    expect(result.segments.at(-1)?.value).toBe(FUNNEL_OTHER);
    const total = result.segments.reduce(
      (sum, s) => sum + (s.counts[0] ?? 0),
      0,
    );
    expect(total).toBe(8);
  });

  test("follows only the earliest entrants beyond the visitor cap", () => {
    const result = summarizeFunnel(
      [
        event("visit", "10:00", "a"),
        event("visit", "10:01", "b"),
        event("checkout", "10:02", "b"),
      ],
      { ...query, steps: ["visit", "checkout"] },
      1,
    );
    expect(result.capped).toBe(true);
    expect(visitors(result)).toEqual([1, 0]);
  });
});

describe("funnel query parsing", () => {
  test("rejects invalid steps, windows, breakdowns and ranges", () => {
    expect(() =>
      normalizeFunnelQuery({ ...query, steps: ["visit"] }),
    ).toThrow();
    expect(() =>
      normalizeFunnelQuery({ ...query, steps: Array(9).fill("visit") }),
    ).toThrow();
    expect(() =>
      normalizeFunnelQuery({ ...query, steps: ["visit", "bad name"] }),
    ).toThrow();
    expect(() =>
      normalizeFunnelQuery({
        ...query,
        steps: [{ event: "visit", route: "orders" }, "paid"],
      }),
    ).toThrow();
    expect(() =>
      normalizeFunnelQuery({
        ...query,
        steps: [
          { event: "visit", property: { key: "Bad-Key", value: "x" } },
          "paid",
        ],
      }),
    ).toThrow();
    expect(() =>
      normalizeFunnelQuery({ ...query, window: "2h" as never }),
    ).toThrow();
    expect(() =>
      normalizeFunnelQuery({ ...query, breakdown: "email" as never }),
    ).toThrow();
    expect(() => normalizeFunnelQuery({ ...query, start: "bad" })).toThrow();
    expect(() =>
      normalizeFunnelQuery({ ...query, start: "2020-01-01" }),
    ).toThrow();
    expect(() =>
      normalizeFunnelQuery({ ...query, start: query.end }),
    ).toThrow();
  });

  test("round-trips steps through the query string and accepts names", () => {
    const steps = [
      { event: "page_view", route: "/quotes/:id" },
      { event: "quote_accepted", property: { key: "channel", value: "a,b" } },
    ];
    expect(
      normalizeFunnelQuery({
        ...query,
        steps: parseFunnelStepsParam(serializeFunnelSteps(steps)) as never,
      }).steps,
    ).toEqual(steps);
    expect(parseFunnelStepsParam("visit,paid")).toEqual(["visit", "paid"]);
    expect(normalizeFunnelQuery(query).window).toBe("1d");
  });
});
