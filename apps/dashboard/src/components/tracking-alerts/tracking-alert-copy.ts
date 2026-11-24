import {
  TRACKING_ALERT_WINDOW_HOURS,
  type TrackingAlertSeverity,
  type TrackingAlertState,
} from "@logly/utils";

export const severityLabels: Record<TrackingAlertSeverity, string> = {
  drop: "Tracking dropped",
  stopped: "Tracking stopped",
};

/** One-sentence explanation of the current alert, using stored counts. */
export function describeTrackingAlert(
  state: Pick<
    TrackingAlertState,
    "status" | "observedEvents" | "baselineEvents"
  >,
) {
  const window = `the last ${TRACKING_ALERT_WINDOW_HOURS} hours`;
  if (state.status === "stopped") {
    return `No events arrived in ${window}; these hours normally bring about ${state.baselineEvents.toLocaleString()}.`;
  }
  if (state.status === "drop") {
    return `${state.observedEvents.toLocaleString()} events in ${window}, against about ${state.baselineEvents.toLocaleString()} normally at these hours.`;
  }
  if (state.status === "low_volume") {
    return "Traffic at these hours is too low to judge, so alerts stay off for now.";
  }
  if (state.status === "pending") return "Not checked yet.";
  return `Event volume is normal for these hours (${state.observedEvents.toLocaleString()} in ${window}).`;
}
