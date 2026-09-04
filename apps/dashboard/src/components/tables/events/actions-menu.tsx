"use client";

import { Button } from "@logly/ui/button";
import type { AnalyticsEventRow } from "@logly/utils";
import { MoreHorizontal } from "lucide-react";
import { useEventParams } from "@/hooks/use-event-params";

export function ActionsMenu({ event }: { event: AnalyticsEventRow }) {
  const { setParams } = useEventParams();
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      aria-label={`Open ${event.name}`}
      onClick={(click) => {
        click.stopPropagation();
        void setParams({ eventId: event.id, eventType: "details" });
      }}
    >
      <MoreHorizontal className="h-4 w-4" />
    </Button>
  );
}
