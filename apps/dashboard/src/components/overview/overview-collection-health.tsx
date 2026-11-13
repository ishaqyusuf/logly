import { cn } from "@logly/ui/cn";
import type { AnalyticsCollectionHealth } from "@logly/utils";
import { formatDistanceToNowStrict } from "date-fns";
import { formatLagDuration } from "@/lib/lag-duration";

function formatUtc(value: string) {
  return new Date(value)
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d+Z$/, " UTC");
}

export function OverviewCollectionHealth({
  health,
  mode,
  className,
}: {
  health: AnalyticsCollectionHealth;
  mode: "demo" | "database";
  className?: string;
}) {
  const observed = mode === "database" ? health.lastReceivedAt : null;
  const lag =
    mode === "database" && health.averageLagSeconds !== null
      ? formatLagDuration(health.averageLagSeconds)
      : null;
  // Only a receipt inside the 24-hour window counts as currently arriving.
  const arriving = Boolean(observed) && health.recentEvents > 0;
  const status =
    mode === "demo"
      ? "Not measured in demo"
      : arriving
        ? "Arrival data available"
        : observed
          ? "No arrivals in 24 hours"
          : "No arrivals yet";
  return (
    <section
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border bg-white shadow-soft",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 px-[18px] pb-3 pt-4">
        <h3 className="text-[13px] font-semibold">Collection health</h3>
        <span className="text-[11px] text-muted-foreground">Last 24 hours</span>
      </div>
      <div className="px-[18px]">
        <div
          className={cn(
            "flex items-center gap-2.5 rounded-[10px] border p-3.5",
            arriving
              ? "border-[#dbe8df] bg-[#f3f8f4]"
              : "border-border bg-[#faf9f6]",
          )}
        >
          <span
            className={cn(
              "size-[7px] shrink-0 rounded-full",
              arriving
                ? "bg-[#22a06b] shadow-[0_0_0_3px_rgba(34,160,107,.16)]"
                : "bg-[#a09c93]",
            )}
            aria-hidden
          />
          <div className="min-w-0">
            <p className="text-[15px] font-semibold tracking-[-0.01em]">
              {status}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {observed
                ? `Last event ${formatDistanceToNowStrict(new Date(observed), { addSuffix: true })}`
                : "Observed persistence in the last 24 hours"}
            </p>
          </div>
        </div>
        <dl className="mt-3.5 grid grid-cols-2">
          <div className="py-1">
            <dt className="text-[11px] text-muted-foreground">
              Events received
            </dt>
            <dd className="mt-1 text-xl font-medium tracking-[-0.03em] tabular-nums">
              {mode === "demo" ? "—" : health.recentEvents.toLocaleString()}
            </dd>
          </div>
          <div className="border-l py-1 pl-3.5">
            <dt className="text-[11px] text-muted-foreground">
              Average arrival lag
            </dt>
            <dd className="mt-1 text-xl font-medium tracking-[-0.03em] tabular-nums">
              {lag ? (
                <>
                  {lag.value}
                  <span className="ml-1 text-xs tracking-normal text-muted-foreground">
                    {lag.unit}
                  </span>
                </>
              ) : (
                <span className="text-sm tracking-normal text-muted-foreground">
                  Not measured
                </span>
              )}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Last received (UTC){" "}
          <span className="font-mono text-foreground">
            {observed ? formatUtc(observed) : "No observation"}
          </span>
        </p>
        {health.clockSkewEvents > 0 && (
          <p className="mt-2.5 text-[11px] text-muted-foreground">
            {health.clockSkewEvents} events have timestamps ahead of receipt and
            are excluded from average lag.
          </p>
        )}
      </div>
      <details className="group mt-auto border-t px-[18px] py-3 text-[11px] leading-normal text-muted-foreground [&_summary::-webkit-details-marker]:hidden">
        <summary className="cursor-pointer list-none font-medium text-foreground">
          How lag is measured
        </summary>
        <p className="mt-1.5">
          Lag includes batching, offline time, and client clock differences.
          Delivery success rate is unknown: events that never arrive cannot be
          measured here.
        </p>
      </details>
    </section>
  );
}
