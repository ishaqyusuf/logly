import { Badge } from "@logly/ui/badge";
import { SheetDescription, SheetHeader, SheetTitle } from "@logly/ui/sheet";
import type { AnalyticsEventRow } from "@logly/utils";
import { formatDistanceToNow } from "date-fns";

export function EventSheetHeader({ event }: { event: AnalyticsEventRow }) {
  return (
    <SheetHeader className="border-b border-border p-6 pr-12">
      <div className="mb-3 flex items-center gap-2">
        <Badge variant={event.source === "server" ? "default" : "success"}>
          {event.source}
        </Badge>
        {event.visitKind && (
          <Badge variant="outline">{event.visitKind} visitor</Badge>
        )}
      </div>
      <SheetTitle className="font-mono text-xl tracking-[-0.03em]">
        {event.name}
      </SheetTitle>
      <SheetDescription>
        Received{" "}
        {formatDistanceToNow(new Date(event.occurredAt), { addSuffix: true })}
      </SheetDescription>
    </SheetHeader>
  );
}
