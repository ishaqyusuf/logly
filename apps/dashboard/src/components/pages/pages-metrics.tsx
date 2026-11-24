import type { AnalyticsPagesReport } from "@logly/utils";
import {
  PercentChange,
  percentChange,
} from "@/components/overview/percent-change";

export function PagesMetrics({
  totals,
  noun,
  previousLabel,
}: {
  totals: AnalyticsPagesReport["totals"];
  noun: "page" | "screen";
  previousLabel: string;
}) {
  const metrics = [
    {
      label: `${noun === "page" ? "Page" : "Screen"} views`,
      value: totals.views,
      change: percentChange(totals.views, totals.previousViews),
    },
    {
      label: "Unique visitors",
      value: totals.visitors,
      change: percentChange(totals.visitors, totals.previousVisitors),
    },
    {
      label: `Views per visitor`,
      value: totals.visitors
        ? Math.round((totals.views / totals.visitors) * 10) / 10
        : 0,
      change: undefined,
    },
  ];
  return (
    <section className="grid overflow-hidden rounded-xl border bg-white shadow-soft sm:grid-cols-3">
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className="border-b px-[18px] py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0"
        >
          <p className="text-xs text-muted-foreground">{metric.label}</p>
          <p className="mt-1.5 text-2xl font-medium tabular-nums tracking-[-0.02em]">
            {metric.value.toLocaleString()}
          </p>
          {metric.change !== undefined ? (
            <p className="mt-1 flex items-center gap-1.5">
              <PercentChange value={metric.change} />
              {metric.change !== null ? (
                <span className="text-[11px] text-muted-foreground">
                  vs {previousLabel}
                </span>
              ) : null}
            </p>
          ) : null}
        </div>
      ))}
    </section>
  );
}
