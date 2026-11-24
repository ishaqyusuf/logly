import type { AnalyticsRetentionReport } from "@logly/utils";
import { formatRate, periodLabel } from "./retention-format";

export function RetentionMetrics({
  report,
}: {
  report: AnalyticsRetentionReport;
}) {
  const unit = report.granularity === "day" ? "day" : "week";
  const first = report.average[1];
  const furthest = [...report.average]
    .reverse()
    .find((point) => point.period > 1 && point.rate !== null);
  const metrics = [
    {
      label: "New users",
      value: report.totals.users.toLocaleString(),
      note: `First seen in these ${report.cohorts.length} ${unit}s`,
    },
    {
      label: `${periodLabel(report.granularity, 1)} retention`,
      value: formatRate(first?.rate),
      note: first?.cohorts
        ? `Back the ${unit} after their first, ${first.cohorts} finished cohort${first.cohorts === 1 ? "" : "s"}`
        : `No cohort has finished its first ${unit} yet`,
    },
    {
      label: furthest
        ? `${periodLabel(report.granularity, furthest.period)} retention`
        : "Longest retention",
      value: formatRate(furthest?.rate),
      note: furthest
        ? `Still returning ${furthest.period} ${unit}s later`
        : "Needs older finished cohorts",
    },
  ];
  return (
    <section className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border bg-border shadow-soft sm:grid-cols-3">
      {metrics.map((metric) => (
        <div key={metric.label} className="min-w-0 bg-white px-[18px] py-4">
          <p className="text-xs text-muted-foreground">{metric.label}</p>
          <p className="mt-1.5 truncate text-2xl font-medium tabular-nums tracking-[-0.02em]">
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
