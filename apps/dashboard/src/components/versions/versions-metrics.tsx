import type { AnalyticsAppVersionsReport } from "@logly/utils";
import { formatShare } from "./versions-format";

export function VersionsMetrics({
  report,
}: {
  report: AnalyticsAppVersionsReport;
}) {
  const latest = report.versions.find((row) => row.latest);
  const metrics = [
    {
      label: "Active app users",
      value: report.totals.activeUsers.toLocaleString(),
      note: `${report.totals.events.toLocaleString()} mobile events`,
    },
    {
      label: "Latest version",
      value: report.latestVersion ?? "—",
      note: latest
        ? `${formatShare(latest.currentShare)} of active users now on it`
        : "No version reported yet",
    },
    {
      label: "Versions in use",
      value: report.totals.versions.toLocaleString(),
      note: "Distinct versions in this range",
    },
    {
      label: "Unknown version",
      value: formatShare(
        report.totals.activeUsers
          ? report.totals.unknownUsers / report.totals.activeUsers
          : 0,
      ),
      note: `${report.totals.unknownUsers.toLocaleString()} users sent no appVersion`,
    },
  ];
  return (
    <section className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border shadow-soft lg:grid-cols-4">
      {metrics.map((metric) => (
        <div key={metric.label} className="min-w-0 bg-white px-[18px] py-4">
          <p className="text-xs text-muted-foreground">{metric.label}</p>
          <p
            className="mt-1.5 truncate text-2xl font-medium tabular-nums tracking-[-0.02em]"
            title={metric.value}
          >
            {metric.value}
          </p>
          <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
            {metric.note}
          </p>
        </div>
      ))}
    </section>
  );
}
