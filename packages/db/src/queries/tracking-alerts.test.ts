import { describe, expect, test } from "bun:test";
import {
  assessTrackingQuiet,
  median,
  TRACKING_ALERT_MIN_BASELINE,
  trackingAlertBaseline,
  trackingAlertWindows,
} from "@logly/utils";

const normal = [100, 110, 90, 105, 95, 100, 98];

describe("tracking-quiet baseline", () => {
  test("median handles odd, even and empty samples", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(3);
    expect(median([])).toBe(0);
  });

  test("uses the lower of the median and the same weekday last week", () => {
    expect(trackingAlertBaseline(normal)).toBe(98);
    // A weekend lull last week lowers the bar instead of alerting.
    expect(trackingAlertBaseline([100, 100, 100, 100, 100, 100, 10])).toBe(10);
  });

  test("windows are 3 hours ending 10 minutes ago, repeated daily", () => {
    const windows = trackingAlertWindows(new Date("2026-11-24T12:10:00Z"));
    expect(windows).toHaveLength(8);
    expect(windows[0]?.start.toISOString()).toBe("2026-11-24T09:00:00.000Z");
    expect(windows[0]?.end.toISOString()).toBe("2026-11-24T12:00:00.000Z");
    expect(windows[7]?.start.toISOString()).toBe("2026-11-17T09:00:00.000Z");
  });
});

describe("assessTrackingQuiet", () => {
  test("normal volume stays ok", () => {
    expect(
      assessTrackingQuiet({ observed: 80, samples: normal, open: null }),
    ).toEqual({ status: "ok", baseline: 98, action: { type: "none" } });
  });

  test("opens a drop below 20% and a stop at zero", () => {
    expect(
      assessTrackingQuiet({ observed: 10, samples: normal, open: null }).action,
    ).toEqual({ type: "open", severity: "drop" });
    expect(
      assessTrackingQuiet({ observed: 0, samples: normal, open: null }),
    ).toMatchObject({ status: "stopped", action: { type: "open" } });
  });

  test("low-traffic projects never open an alert", () => {
    const quiet = Array(7).fill(TRACKING_ALERT_MIN_BASELINE - 1);
    expect(
      assessTrackingQuiet({ observed: 0, samples: quiet, open: null }),
    ).toEqual({
      status: "low_volume",
      baseline: TRACKING_ALERT_MIN_BASELINE - 1,
      action: { type: "none" },
    });
  });

  test("hysteresis: an open alert needs half the baseline to resolve", () => {
    // 30 is above the 20% open line but below the 50% resolve line.
    expect(
      assessTrackingQuiet({ observed: 30, samples: normal, open: "drop" }),
    ).toEqual({ status: "drop", baseline: 98, action: { type: "none" } });
    expect(
      assessTrackingQuiet({ observed: 49, samples: normal, open: "drop" })
        .action,
    ).toEqual({ type: "resolve" });
  });

  test("escalates and de-escalates an open alert", () => {
    expect(
      assessTrackingQuiet({ observed: 0, samples: normal, open: "drop" })
        .action,
    ).toEqual({ type: "update", severity: "stopped" });
    expect(
      assessTrackingQuiet({ observed: 5, samples: normal, open: "stopped" })
        .action,
    ).toEqual({ type: "update", severity: "drop" });
  });

  test("a long outage stays open after the baseline decays", () => {
    const decayed = [0, 0, 0, 0, 100, 100, 100];
    expect(
      assessTrackingQuiet({ observed: 0, samples: decayed, open: "stopped" }),
    ).toEqual({ status: "stopped", baseline: 0, action: { type: "none" } });
    // Recovery against a decayed baseline needs half the minimum volume.
    expect(
      assessTrackingQuiet({ observed: 15, samples: decayed, open: "stopped" }),
    ).toEqual({
      status: "low_volume",
      baseline: 0,
      action: { type: "resolve" },
    });
  });
});
