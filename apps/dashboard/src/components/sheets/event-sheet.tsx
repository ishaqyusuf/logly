"use client";

import { useTrack } from "@ishaqyusuf/logly-next";
import { Sheet, SheetContent } from "@logly/ui/sheet";
import type { AnalyticsEventRow } from "@logly/utils";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { EventContent } from "@/components/event-content";
import { useEventParams } from "@/hooks/use-event-params";

export function EventSheet() {
  const { eventId, eventType, setParams } = useEventParams();
  const project = useSearchParams().get("project");
  const track = useTrack();
  const open = eventType === "details" && Boolean(eventId && project);
  const eventQuery = useQuery({
    queryKey: ["dashboard-event", project, eventId],
    queryFn: async () => {
      const response = await fetch(
        `/api/dashboard/events/${eventId}?project=${encodeURIComponent(project ?? "")}`,
      );
      if (!response.ok) throw new Error("Could not load this event");
      return response.json() as Promise<AnalyticsEventRow>;
    },
    enabled: open,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (open && eventQuery.data) {
      track("event_opened", { event_name: eventQuery.data.name });
    }
  }, [eventQuery.data, open, track]);

  return (
    <Sheet open={open} onOpenChange={(next) => !next && setParams(null)}>
      <SheetContent className="overflow-y-auto bg-[#fbfaf7] p-0 sm:max-w-[560px]">
        <EventContent
          event={eventQuery.data}
          loading={eventQuery.isLoading}
          error={eventQuery.error instanceof Error ? eventQuery.error : null}
        />
      </SheetContent>
    </Sheet>
  );
}
