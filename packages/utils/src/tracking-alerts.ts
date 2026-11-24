/**
 * Tracking-quiet alerts: detect when a project's event volume drops far below
 * its normal level for the same hours, or stops entirely.
 */

/** Length of the recent window compared with the baseline. */
export const TRACKING_ALERT_WINDOW_HOURS = 3;
/** Ignore the newest minutes so normal batching and delivery lag don't read as a drop. */
export const TRACKING_ALERT_LAG_MINUTES = 10;
/** Previous days sampled at the same hours; day 7 is the same weekday last week. */
export const TRACKING_ALERT_BASELINE_DAYS = 7;
/** Minimum baseline events per window before a project can alert (anti-flap). */
export const TRACKING_ALERT_MIN_BASELINE = 30;
/** Open an alert when the recent window falls below this share of the baseline. */
export const TRACKING_ALERT_OPEN_RATIO = 0.2;
/** Resolve once the recent window recovers to this share of the baseline. */
export const TRACKING_ALERT_RESOLVE_RATIO = 0.5;
/** Evaluate a project at most this often; reads in between reuse stored state. */
export const TRACKING_ALERT_EVALUATE_EVERY_MINUTES = 5;

export type TrackingAlertSeverity = "drop" | "stopped";

export type TrackingAlertStatus =
  | TrackingAlertSeverity
  /** Volume is within normal bounds. */
  | "ok"
  /** Baseline below the minimum volume, so no alert can open. */
  | "low_volume"
  /** Not evaluated yet. */
  | "pending";

export type TrackingAlertState = {
  status: TrackingAlertStatus;
  observedEvents: number;
  baselineEvents: number;
  windowStart: string | null;
  windowEnd: string | null;
  evaluatedAt: string | null;
  /** When the currently open alert opened, if any. */
  openedAt: string | null;
};

export type TrackingAlertHistoryRow = {
  id: string;
  severity: TrackingAlertSeverity;
  openedAt: string;
  resolvedAt: string | null;
  observedEvents: number;
  baselineEvents: number;
};

export type TrackingAlertsReport = {
  state: TrackingAlertState;
  history: TrackingAlertHistoryRow[];
};

export type TrackingAlertAction =
  | { type: "none" }
  | { type: "open"; severity: TrackingAlertSeverity }
  | { type: "update"; severity: TrackingAlertSeverity }
  | { type: "resolve" };

export function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? (sorted[middle] as number)
    : Math.round(
        ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2,
      );
}

/**
 * Baseline for the recent window: the lower of the median of the previous
 * days at the same hours and the same weekday last week. Taking the lower
 * value keeps weekly lulls (weekends, nights) from reading as an outage.
 * `samples[0]` is yesterday; `samples[6]` is the same weekday last week.
 */
export function trackingAlertBaseline(samples: number[]) {
  if (!samples.length) return 0;
  const sameWeekday = samples[TRACKING_ALERT_BASELINE_DAYS - 1];
  const typical = median(samples);
  return sameWeekday === undefined ? typical : Math.min(typical, sameWeekday);
}

/** Recent window and previous same-hour windows, newest first (offset 0 = now). */
export function trackingAlertWindows(now: Date) {
  const end = new Date(now.getTime() - TRACKING_ALERT_LAG_MINUTES * 60_000);
  const start = new Date(
    end.getTime() - TRACKING_ALERT_WINDOW_HOURS * 3_600_000,
  );
  return Array.from({ length: TRACKING_ALERT_BASELINE_DAYS + 1 }, (_, day) => ({
    day,
    start: new Date(start.getTime() - day * 86_400_000),
    end: new Date(end.getTime() - day * 86_400_000),
  }));
}

/**
 * Decide the project's status and what to do with its open alert. Pure, so
 * the scheduled-free evaluator stays idempotent: the same counts always give
 * the same decision.
 */
export function assessTrackingQuiet(input: {
  observed: number;
  samples: number[];
  open: TrackingAlertSeverity | null;
}): {
  status: TrackingAlertStatus;
  baseline: number;
  action: TrackingAlertAction;
} {
  const baseline = trackingAlertBaseline(input.samples);
  const severity: TrackingAlertSeverity =
    input.observed === 0 ? "stopped" : "drop";

  if (input.open) {
    // Hysteresis: recovery needs half the normal volume (or half the minimum
    // when the baseline itself has decayed during a long outage).
    const recovery =
      TRACKING_ALERT_RESOLVE_RATIO *
      Math.max(baseline, TRACKING_ALERT_MIN_BASELINE);
    if (input.observed >= recovery) {
      return {
        status: baseline < TRACKING_ALERT_MIN_BASELINE ? "low_volume" : "ok",
        baseline,
        action: { type: "resolve" },
      };
    }
    return {
      status: severity,
      baseline,
      action:
        severity === input.open
          ? { type: "none" }
          : { type: "update", severity },
    };
  }

  if (baseline < TRACKING_ALERT_MIN_BASELINE) {
    return { status: "low_volume", baseline, action: { type: "none" } };
  }
  if (input.observed < TRACKING_ALERT_OPEN_RATIO * baseline) {
    return { status: severity, baseline, action: { type: "open", severity } };
  }
  return { status: "ok", baseline, action: { type: "none" } };
}

export function isTrackingAlertOpen(
  status: TrackingAlertStatus | undefined,
): status is TrackingAlertSeverity {
  return status === "drop" || status === "stopped";
}
