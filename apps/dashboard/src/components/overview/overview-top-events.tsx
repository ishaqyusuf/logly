import type { AnalyticsTopEvent } from "@logly/utils";
import { ArrowRight } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import {
  PercentChange,
  percentChange,
} from "@/components/overview/percent-change";

function TopEventChange({ event }: { event: AnalyticsTopEvent }) {
  if (event.previousCount === undefined) return null;
  if (event.previousCount === 0 && event.count > 0) {
    return (
      <span className="text-[11px] font-medium text-muted-foreground">New</span>
    );
  }
  return (
    <PercentChange value={percentChange(event.count, event.previousCount)} />
  );
}

export function OverviewTopEvents({
  events,
  previousLabel,
  href,
}: {
  events: AnalyticsTopEvent[];
  previousLabel: string;
  href: Route;
}) {
  const max = events[0]?.count ?? 0;
  const compared = events.some((event) => event.previousCount !== undefined);
  return (
    <section className="flex flex-col overflow-hidden rounded-xl border bg-white shadow-soft">
      <div className="flex items-center justify-between gap-3 px-[18px] pb-3 pt-4">
        <h3 className="text-[13px] font-semibold">Top events</h3>
        {compared ? (
          <span className="text-[11px] text-muted-foreground">
            vs {previousLabel.toLowerCase()}
          </span>
        ) : null}
      </div>
      {events.length ? (
        <ol className="px-[18px] pb-2">
          {events.map((event) => (
            <li
              key={event.name}
              className="grid grid-cols-[minmax(0,1fr)_auto_72px] items-center gap-x-3 gap-y-1.5 border-t border-[#f0ede7] py-2 text-xs first:border-t-0"
            >
              <span className="truncate font-mono">{event.name}</span>
              <span className="text-right font-medium tabular-nums">
                {event.count.toLocaleString()}
              </span>
              <span className="justify-self-end">
                <TopEventChange event={event} />
              </span>
              <span
                className="col-span-full h-[3px] overflow-hidden rounded-full bg-[#f0ede7]"
                aria-hidden
              >
                <span
                  className="block h-full rounded-full bg-[#9cc2aa] [li:first-child_&]:bg-[#347b56]"
                  style={{
                    width: `${max ? (event.count / max) * 100 : 0}%`,
                  }}
                />
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="px-[18px] pb-5 text-xs text-muted-foreground">
          No events in this window.
        </p>
      )}
      <div className="mt-auto flex justify-end border-t px-[18px] py-3">
        <Link
          href={href}
          className="flex items-center gap-1 text-xs font-medium text-[#347b56]"
        >
          All events <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </section>
  );
}
