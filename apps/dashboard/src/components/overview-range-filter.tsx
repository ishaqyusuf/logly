import type { AnalyticsOverviewRange } from "@logly/utils";
import Link from "next/link";

const ranges: AnalyticsOverviewRange[] = ["24h", "7d", "30d"];

export function OverviewRangeFilter({
  range,
  query,
}: {
  range: AnalyticsOverviewRange;
  query: URLSearchParams;
}) {
  return (
    <div aria-label="Overview date range" className="flex items-center rounded-lg border bg-white p-1">
      {ranges.map((option) => {
        const params = new URLSearchParams(query);
        params.set("range", option);
        return (
          <Link
            key={option}
            href={`/overview?${params}`}
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
