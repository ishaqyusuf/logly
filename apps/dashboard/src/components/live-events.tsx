"use client";

import { Badge } from "@logly/ui/badge";
import type { AnalyticsEventPage } from "@logly/utils";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { Activity, Radio } from "lucide-react";
import { useEventParams } from "@/hooks/use-event-params";

export function LiveEvents({
  initialPage,
  organization,
  project,
}: {
  initialPage: AnalyticsEventPage;
  organization?: string;
  project: string;
}) {
  const { setParams } = useEventParams();
  const eventsQuery = useQuery({
    queryKey: ["dashboard-live-events", project],
    queryFn: async () => {
      const params = new URLSearchParams({
        project,
        pageSize: "50",
        start: new Date(Date.now() - 15 * 60_000).toISOString(),
      });
      if (organization) params.set("organization", organization);
      const response = await fetch(`/api/dashboard/events?${params}`);
      if (!response.ok) throw new Error("Could not refresh live events");
      return response.json() as Promise<AnalyticsEventPage>;
    },
    initialData: initialPage,
    refetchInterval: 10_000,
  });
  return (
    <section className="overflow-hidden rounded-xl border bg-white shadow-soft">
      <div className="flex items-center justify-between border-b p-5">
        <div>
          <p className="text-sm font-semibold">Live stream</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Automatically refreshes every 10 seconds
          </p>
        </div>
        <Badge variant="success" className="gap-1.5">
          <Radio className="size-3" />
          Listening
        </Badge>
      </div>
      <div className="divide-y">
        {eventsQuery.data.data.map((event) => (
          <button
            key={event.id}
            type="button"
            onClick={() =>
              void setParams({ eventId: event.id, eventType: "details" })
            }
            className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/50"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#edf3ee] text-[#347b56]">
              <Activity className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-mono text-xs font-medium">
                {event.name}
              </p>
              <p className="mt-1 truncate text-[11px] text-muted-foreground">
                {event.route ?? "Server event"}
              </p>
            </div>
            <Badge variant="outline">{event.source}</Badge>
            <span className="hidden whitespace-nowrap text-[11px] text-muted-foreground sm:block">
              {formatDistanceToNowStrict(new Date(event.occurredAt), {
                addSuffix: true,
              })}
            </span>
          </button>
        ))}
        {!eventsQuery.data.data.length && (
          <div className="grid min-h-64 place-items-center p-8 text-center">
            <div>
              <Radio className="mx-auto mb-3 size-5 text-muted-foreground" />
              <p className="text-sm font-medium">Waiting for the next signal</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Events received in the last 15 minutes appear here.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
