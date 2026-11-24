"use client";

import { cn } from "@logly/ui/cn";
import type {
  AnalyticsOverview,
  AnalyticsRelease,
  AnalyticsTrendPoint,
} from "@logly/utils";
import {
  MousePointerClick,
  Send,
  UserRoundPlus,
  UsersRound,
} from "lucide-react";
import { type KeyboardEvent, useRef } from "react";
import {
  OverviewTrendChart,
  type OverviewTrendDatum,
} from "@/components/charts/overview-trend-chart";
import { PercentChange } from "@/components/overview/percent-change";
import {
  type OverviewMetric,
  overviewMetrics,
  useOverviewParams,
} from "@/hooks/use-overview-params";

const metricConfig: Record<
  OverviewMetric,
  {
    label: string;
    icon: typeof UsersRound;
    key: keyof Omit<AnalyticsTrendPoint, "date">;
  }
> = {
  visitors: { label: "Unique visitors", icon: UsersRound, key: "visitors" },
  new: { label: "New visitors", icon: UserRoundPlus, key: "newVisitors" },
  returning: {
    label: "Returning",
    icon: MousePointerClick,
    key: "returningVisitors",
  },
  events: { label: "Events", icon: Send, key: "events" },
};

function metricValue(overview: AnalyticsOverview, metric: OverviewMetric) {
  switch (metric) {
    case "visitors":
      return overview.uniqueVisitors;
    case "new":
      return overview.newVisitors;
    case "returning":
      return overview.returningVisitors;
    case "events":
      return overview.totalEvents;
  }
}

function MetricContext({
  overview,
  metric,
}: {
  overview: AnalyticsOverview;
  metric: OverviewMetric;
}) {
  if (metric === "visitors" || metric === "events") {
    return (
      <PercentChange
        value={
          metric === "visitors"
            ? overview.change.visitors
            : overview.change.events
        }
      />
    );
  }
  const share = overview.uniqueVisitors
    ? Math.round((overview.returningVisitors / overview.uniqueVisitors) * 100)
    : null;
  if (share === null) return null;
  return (
    <span className="text-[11px] text-muted-foreground">
      {metric === "new" ? 100 - share : share}% of visitors
    </span>
  );
}

export function OverviewMetrics({
  overview,
  windowLabel,
  previousLabel,
  releases,
}: {
  overview: AnalyticsOverview;
  windowLabel: string;
  previousLabel: string;
  releases?: AnalyticsRelease[];
}) {
  const { metric, setMetric } = useOverviewParams();
  const tabsRef = useRef<Array<HTMLButtonElement | null>>([]);
  const config = metricConfig[metric];
  const trend = overview.trend ?? [];
  const previous = overview.previousTrend;
  const hasSeries = trend.some((point) => point[config.key] !== undefined);
  const hasActivity = trend.some((point) => point.events > 0);
  const data: OverviewTrendDatum[] = trend.map((point, index) => {
    const prior = previous?.[index]?.[config.key];
    return {
      date: point.date,
      current: point[config.key] ?? 0,
      previous: typeof prior === "number" ? prior : undefined,
    };
  });

  function onTabKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const index = overviewMetrics.indexOf(metric);
    const step = event.key === "ArrowRight" ? 1 : -1;
    const next =
      overviewMetrics[
        (index + step + overviewMetrics.length) % overviewMetrics.length
      ] ?? "visitors";
    void setMetric(next);
    tabsRef.current[overviewMetrics.indexOf(next)]?.focus();
  }

  return (
    <section className="overflow-hidden rounded-xl border bg-white shadow-soft">
      <div
        role="tablist"
        aria-label="Overview metric"
        onKeyDown={onTabKeyDown}
        className="grid grid-cols-2 border-b lg:grid-cols-4"
      >
        {overviewMetrics.map((item, index) => {
          const Icon = metricConfig[item].icon;
          const selected = item === metric;
          return (
            <button
              key={item}
              ref={(node) => {
                tabsRef.current[index] = node;
              }}
              type="button"
              role="tab"
              id={`overview-tab-${item}`}
              aria-selected={selected}
              aria-controls="overview-metric-panel"
              tabIndex={selected ? 0 : -1}
              onClick={() => void setMetric(item)}
              className={cn(
                "relative flex flex-col gap-2.5 bg-[#faf9f6] p-4 text-left transition-colors hover:bg-[#f6f5f1] focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#347b56] sm:px-[22px] sm:py-[18px]",
                index % 2 === 1 && "border-l",
                index >= 2 && "border-t lg:border-t-0",
                index === 2 && "lg:border-l",
                selected &&
                  "bg-white hover:bg-white before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:bg-[#347b56]",
              )}
            >
              <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Icon
                  className={cn(
                    "size-3.5",
                    selected ? "text-[#347b56]" : "text-[#a09c93]",
                  )}
                />
                {metricConfig[item].label}
              </span>
              <span className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                <span className="text-[22px] font-medium leading-none tracking-[-0.045em] tabular-nums sm:text-[30px]">
                  {metricValue(overview, item).toLocaleString()}
                </span>
                <MetricContext overview={overview} metric={item} />
              </span>
            </button>
          );
        })}
      </div>
      <div
        id="overview-metric-panel"
        role="tabpanel"
        aria-labelledby={`overview-tab-${metric}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 sm:px-[22px]">
          <p className="text-xs text-muted-foreground">
            {config.label} · {windowLabel}
          </p>
          {previous ? (
            <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 border-t-2 border-[#347b56]" />
                This period
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 border-t-[1.5px] border-dashed border-[#9a958c]" />
                {previousLabel}
              </span>
              {releases?.length ? (
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rotate-45 bg-[#b45309]" />
                  Release
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="px-2 pb-4 pt-2 sm:pr-[18px] sm:pl-3">
          {hasSeries && hasActivity ? (
            <OverviewTrendChart
              data={data}
              granularity={overview.trendGranularity ?? "day"}
              metricLabel={config.label}
              releases={releases}
            />
          ) : (
            <div className="grid h-[300px] place-items-center rounded-lg border border-dashed text-center text-xs text-muted-foreground">
              {!hasActivity
                ? `No events in the ${windowLabel}.`
                : `${config.label} over time is not available from this collector yet.`}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
