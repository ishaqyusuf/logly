import { cn } from "@logly/ui/cn";
import type { AnalyticsProjectSummary } from "@logly/utils";
import { formatDistanceToNowStrict } from "date-fns";

const statusLabels: Record<AnalyticsProjectSummary["status"], string> = {
  healthy: "Collecting",
  quiet: "Quiet",
  attention: "No events yet",
};

/** Project collection status from the latest event (healthy = within 24 hours). */
export function OverviewStatus({
  project,
}: {
  project: Pick<AnalyticsProjectSummary, "status" | "lastEventAt">;
}) {
  const healthy = project.status === "healthy";
  return (
    <span
      className={cn(
        "inline-flex h-[26px] items-center gap-[7px] whitespace-nowrap rounded-full border px-2.5 text-xs font-medium",
        healthy
          ? "border-[#d5e4d9] bg-[#f3f8f4] text-[#286c49]"
          : "border-amber-200 bg-amber-50 text-amber-800",
      )}
    >
      <span
        className={cn(
          "size-[7px] rounded-full",
          healthy
            ? "bg-[#22a06b] shadow-[0_0_0_3px_rgba(34,160,107,.16)] motion-safe:animate-pulse"
            : "bg-amber-500",
        )}
        aria-hidden
      />
      {statusLabels[project.status]}
      {project.lastEventAt ? (
        <span className="font-normal text-muted-foreground">
          · last event{" "}
          {formatDistanceToNowStrict(new Date(project.lastEventAt), {
            addSuffix: true,
          })}
        </span>
      ) : null}
    </span>
  );
}
