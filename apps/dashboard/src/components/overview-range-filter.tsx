"use client";

import type { AnalyticsOverviewRange } from "@logly/utils";
import type { Route } from "next";
import Link from "next/link";
import { useOverviewParams } from "@/hooks/use-overview-params";

const ranges: AnalyticsOverviewRange[] = ["24h", "7d", "30d"];

export function OverviewRangeFilter({
  range,
  query,
}: {
  range: AnalyticsOverviewRange;
  query: string;
}) {
  // The metric tab changes the URL shallowly, so read it here to carry it over.
  const { metric } = useOverviewParams();
  return (
    <div
      aria-label="Overview date range"
      className="flex items-center rounded-lg border bg-white p-1"
    >
      {ranges.map((option) => {
        const params = new URLSearchParams(query);
        params.set("range", option);
        if (metric !== "visitors") params.set("metric", metric);
        return (
          <Link
            key={option}
            href={`/overview?${params}` as Route}
            aria-current={range === option ? "page" : undefined}
            className={`inline-flex h-7 items-center rounded-md px-2.5 text-xs font-medium ${
              range === option
                ? "border bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            }`}
          >
            {option}
          </Link>
        );
      })}
    </div>
  );
}
