import { cn } from "@logly/ui/cn";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

/** Signed prior-window change; null means the prior window had no data. */
export function PercentChange({
  value,
  className,
}: {
  value: number | null | undefined;
  className?: string;
}) {
  if (value === null || value === undefined) {
    return (
      <span className={cn("text-[11px] text-muted-foreground", className)}>
        No prior-period data
      </span>
    );
  }
  const positive = value >= 0;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 whitespace-nowrap text-[11px] font-medium tabular-nums",
        positive ? "text-emerald-700" : "text-red-600",
        className,
      )}
    >
      <Icon className="size-3" aria-hidden />
      <span className="sr-only">{positive ? "Up" : "Down"} </span>
      {Math.abs(value).toFixed(1).replace(/\.0$/, "")}%
    </span>
  );
}

export function percentChange(current: number, previous?: number) {
  if (previous === undefined || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}
