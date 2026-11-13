import type { AnalyticsEventRow } from "@logly/utils";
import { formatDistanceToNowStrict } from "date-fns";
import { ArrowRight, Globe, Server, Smartphone } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

const sourceIcons = {
  browser: Globe,
  server: Server,
  mobile: Smartphone,
} as const;

export function OverviewRecentEvents({
  events,
  href,
}: {
  events: AnalyticsEventRow[];
  href: Route;
}) {
  return (
    <section className="flex flex-col overflow-hidden rounded-xl border bg-white shadow-soft">
      <div className="flex items-center justify-between gap-3 px-[18px] pb-3 pt-4">
        <h3 className="text-[13px] font-semibold">Recent events</h3>
        <span className="text-[11px] text-muted-foreground">Newest first</span>
      </div>
      {events.length ? (
        <ul className="flex-1 px-[18px]">
          {events.map((event) => {
            const Icon = sourceIcons[event.source];
            return (
              <li
                key={event.id}
                className="grid grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-2.5 border-t border-[#f0ede7] py-2.5 first:border-t-0"
              >
                <span className="grid place-items-center text-[#a09c93]">
                  <Icon className="size-3.5" aria-label={event.source} />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs font-medium">
                    {event.name}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {event.route ?? event.platform ?? event.source}
                  </p>
                </div>
                <time
                  dateTime={event.occurredAt}
                  className="whitespace-nowrap text-[11px] tabular-nums text-muted-foreground"
                >
                  {formatDistanceToNowStrict(new Date(event.occurredAt), {
                    addSuffix: true,
                  })}
                </time>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="flex-1 px-[18px] pb-5 text-xs text-muted-foreground">
          No events in this window.
        </p>
      )}
      <div className="mt-auto flex justify-end border-t px-[18px] py-3">
        <Link
          href={href}
          className="flex items-center gap-1 text-xs font-medium text-[#347b56]"
        >
          View stream <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </section>
  );
}
