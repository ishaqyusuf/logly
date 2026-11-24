import { cn } from "@logly/ui/cn";
import type { AnalyticsOverviewRange } from "@logly/utils";
import type { Route } from "next";
import Link from "next/link";

const ranges: AnalyticsOverviewRange[] = ["24h", "7d", "30d"];

/** URL-backed range control, the same presets as Overview and Pages. */
export function VersionsRangeFilter({
  query,
  range,
}: {
  query: string;
  range: AnalyticsOverviewRange;
}) {
  return (
    <nav
      aria-label="Versions date range"
      className="flex items-center rounded-lg border bg-white p-1"
    >
      {ranges.map((option) => {
        const params = new URLSearchParams(query);
        params.set("range", option);
        const active = option === range;
        return (
          <Link
            key={option}
            href={`/versions?${params}` as Route}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-7 items-center rounded-md px-2.5 text-xs font-medium",
              active
                ? "border bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            {option}
          </Link>
        );
      })}
    </nav>
  );
}
