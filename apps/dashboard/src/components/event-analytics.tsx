"use client";

import { Badge } from "@logly/ui/badge";
import type { AnalyticsEventQuery, AnalyticsEventSummary } from "@logly/utils";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  RadioTower,
} from "lucide-react";
import { useMemo, useRef } from "react";
import { EventRangeFilter } from "@/components/event-range-filter";
import { OverviewChart } from "@/components/overview-chart";
import { useEventFilterParams } from "@/hooks/use-event-filter-params";

function searchParams(query: AnalyticsEventQuery) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, Array.isArray(value) ? value.join(",") : String(value));
  }
  return params;
}

export function EventAnalytics({
  initialSummary,
  scope,
  projectName,
}: {
  initialSummary: AnalyticsEventSummary;
  scope: { organization?: string; project: string };
  projectName: string;
}) {
  const { filter } = useEventFilterParams();
  const sources = filter.sources?.filter(
    (source): source is "browser" | "server" | "mobile" =>
      source === "browser" || source === "server" || source === "mobile",
  );
  const platforms = filter.platforms?.filter(
    (platform): platform is "web" | "ios" | "android" =>
      platform === "web" || platform === "ios" || platform === "android",
  );
  const query = useMemo<AnalyticsEventQuery>(
    () => ({
      ...scope,
      names: filter.names ?? undefined,
      sources,
      platforms,
      q: filter.q ?? undefined,
      start: filter.start ?? undefined,
      end: filter.end ?? undefined,
    }),
    [
      filter.end,
      filter.names,
      filter.q,
      filter.start,
      platforms,
      scope,
      sources,
    ],
  );
  const initialQuery = useRef(JSON.stringify(query)).current;
  const summaryQuery = useQuery({
    queryKey: ["dashboard-event-summary", query],
    queryFn: async () => {
      const response = await fetch(
        `/api/dashboard/event-summary?${searchParams(query)}`,
      );
      if (!response.ok) throw new Error("Could not load event analytics");
      return response.json() as Promise<AnalyticsEventSummary>;
    },
    initialData:
      initialQuery === JSON.stringify(query) ? initialSummary : undefined,
  });
  const summary = summaryQuery.data ?? initialSummary;
  const maximum = Math.max(
    ...summary.eventNames.map((event) => event.count),
    1,
  );
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground">
          Analytics update with every filter below.
        </p>
        <EventRangeFilter />
      </div>
      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1.4fr)_minmax(280px,.8fr)]">
        <section className="rounded-xl bg-[#17201b] p-5 text-white shadow-soft">
          <div className="flex items-center justify-between text-emerald-300">
            <span className="text-xs font-medium uppercase tracking-[0.12em]">
              Filtered total
            </span>
            <RadioTower className="size-4" />
          </div>
          <p className="mt-8 text-4xl font-medium tracking-[-0.05em] tabular-nums">
            {summary.totalEvents.toLocaleString()}
          </p>
          <p className="mt-2 text-sm text-white/60">events in {projectName}</p>
          <div className="mt-8 flex items-center justify-between border-t border-white/10 pt-4 text-xs">
            <span className="text-white/50">Unique event names</span>
            <span>{summary.uniqueEventNames}</span>
          </div>
        </section>
        <section className="rounded-xl border bg-white p-5 shadow-soft">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Event volume</p>
              <p className="mt-1 text-xs text-muted-foreground">
                The complete filtered window
              </p>
            </div>
            <BarChart3 className="size-4 text-muted-foreground" />
          </div>
          <OverviewChart data={summary.trend} height={205} />
        </section>
        <section className="overflow-hidden rounded-xl border bg-white shadow-soft">
          <div className="border-b p-5">
            <p className="text-sm font-semibold">Momentum</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Against the prior equal window
            </p>
          </div>
          <div className="divide-y">
            {summary.eventNames.slice(0, 4).map((event) => (
              <div
                key={event.name}
                className="flex items-center gap-3 px-5 py-3"
              >
                <span className="min-w-0 flex-1 truncate font-mono text-xs">
                  {event.name}
                </span>
                <Badge
                  variant="outline"
                  className={
                    event.change >= 0 ? "text-emerald-700" : "text-red-600"
                  }
                >
                  {event.change >= 0 ? (
                    <ArrowUpRight className="mr-1 size-3" />
                  ) : (
                    <ArrowDownRight className="mr-1 size-3" />
                  )}
                  {Math.abs(event.change)}%
                </Badge>
              </div>
            ))}
            {!summary.eventNames.length && (
              <p className="p-5 text-xs text-muted-foreground">
                No events match this window.
              </p>
            )}
          </div>
        </section>
      </div>
      <section className="rounded-xl border bg-white p-5 shadow-soft">
        <div className="mb-5">
          <p className="text-sm font-semibold">Count by event name</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Every distinct event in the current filter
          </p>
        </div>
        <div className="grid gap-x-8 gap-y-4 md:grid-cols-2">
          {summary.eventNames.map((event) => (
            <div
              key={event.name}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3"
            >
              <div className="min-w-0">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="truncate font-mono text-xs">
                    {event.name}
                  </span>
                  <span className="text-xs font-medium tabular-nums">
                    {event.count.toLocaleString()}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-[#4f8c68]"
                    style={{
                      width: `${Math.max(3, (event.count / maximum) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
