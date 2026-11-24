import { cn } from "@logly/ui/cn";
import {
  isTrackingAlertOpen,
  TRACKING_ALERT_MIN_BASELINE,
  TRACKING_ALERT_OPEN_RATIO,
  TRACKING_ALERT_WINDOW_HOURS,
  type TrackingAlertsReport,
} from "@logly/utils";
import { format, formatDistanceStrict } from "date-fns";
import {
  describeTrackingAlert,
  severityLabels,
} from "@/components/tracking-alerts/tracking-alert-copy";

/** Settings section: current tracking-quiet state and recent alert history. */
export function TrackingAlertHistory({
  report,
}: {
  report: TrackingAlertsReport | null;
}) {
  const open = report ? isTrackingAlertOpen(report.state.status) : false;
  return (
    <section
      id="tracking-alerts"
      className="scroll-mt-24 rounded-xl border bg-white shadow-soft"
    >
      <div className="border-b p-5">
        <h3 className="text-sm font-semibold">Tracking alerts</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Alerts when the last {TRACKING_ALERT_WINDOW_HOURS} hours bring fewer
          than {Math.round(TRACKING_ALERT_OPEN_RATIO * 100)}% of the events
          these hours normally do, compared with the previous 7 days. Projects
          below {TRACKING_ALERT_MIN_BASELINE} events per window are not alerted.
          Shown here only; email alerts are not available yet.
        </p>
      </div>
      {report ? (
        <>
          <div className="flex items-start gap-3 p-5">
            <span
              className={cn(
                "mt-1 size-2 shrink-0 rounded-full",
                open
                  ? "bg-red-500"
                  : report.state.status === "ok"
                    ? "bg-[#22a06b]"
                    : "bg-muted-foreground/40",
              )}
              aria-hidden
            />
            <div className="text-sm">
              <p className="font-medium">
                {open
                  ? severityLabels[
                      report.state.status as keyof typeof severityLabels
                    ]
                  : report.state.status === "ok"
                    ? "Tracking normal"
                    : report.state.status === "low_volume"
                      ? "Not enough traffic to alert"
                      : "Not checked yet"}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {describeTrackingAlert(report.state)}
                {report.state.evaluatedAt
                  ? ` Checked ${format(new Date(report.state.evaluatedAt), "MMM d, HH:mm")}.`
                  : ""}
              </p>
            </div>
          </div>
          {report.history.length ? (
            <ol className="border-t px-5 py-2">
              {report.history.map((alert) => (
                <li
                  key={alert.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-0.5 border-t border-[#f0ede7] py-2.5 text-xs first:border-t-0"
                >
                  <span className="font-medium">
                    {severityLabels[alert.severity]}
                  </span>
                  <span
                    className={cn(
                      "text-right",
                      alert.resolvedAt
                        ? "text-muted-foreground"
                        : "font-medium text-red-700",
                    )}
                  >
                    {alert.resolvedAt
                      ? `Resolved after ${formatDistanceStrict(new Date(alert.resolvedAt), new Date(alert.openedAt))}`
                      : "Open"}
                  </span>
                  <span className="text-muted-foreground">
                    {format(new Date(alert.openedAt), "MMM d, yyyy HH:mm")}
                  </span>
                  <span className="text-right tabular-nums text-muted-foreground">
                    {alert.observedEvents.toLocaleString()} vs ~
                    {alert.baselineEvents.toLocaleString()} events
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="border-t px-5 py-4 text-xs text-muted-foreground">
              No alerts yet.
            </p>
          )}
        </>
      ) : (
        <p className="p-5 text-xs text-muted-foreground">
          Alert history needs the analytics database.
        </p>
      )}
    </section>
  );
}
