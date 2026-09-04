"use client";

import { Button } from "@logly/ui/button";
import { useEventFilterParams } from "@/hooks/use-event-filter-params";

const ranges = [
  { label: "24h", hours: 24 },
  { label: "7d", hours: 24 * 7 },
  { label: "30d", hours: 24 * 30 },
];

export function EventRangeFilter() {
  const { filter, setFilter } = useEventFilterParams();
  const selectedHours = filter.start
    ? Math.round((Date.now() - new Date(filter.start).getTime()) / 3_600_000)
    : 24 * 7;
  return (
    <div className="flex items-center rounded-lg border bg-white p-1">
      {ranges.map((range) => (
        <Button
          key={range.label}
          type="button"
          size="sm"
          variant={
            Math.abs(selectedHours - range.hours) < 2 ? "outline" : "ghost"
          }
          className="h-7 px-2.5 text-xs"
          onClick={() =>
            void setFilter({
              start: new Date(
                Date.now() - range.hours * 3_600_000,
              ).toISOString(),
              end: null,
            })
          }
        >
          {range.label}
        </Button>
      ))}
    </div>
  );
}
