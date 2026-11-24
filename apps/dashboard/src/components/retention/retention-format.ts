import type { RetentionGranularity } from "@logly/utils";
import { format } from "date-fns";

/** Brand green; heat cells scale its opacity by the retained share. */
export const RETENTION_COLOR = "#347b56";

export function formatRate(rate: number | null | undefined) {
  if (rate === null || rate === undefined) return "—";
  if (rate > 0 && rate < 0.001) return "<0.1%";
  const percent = rate * 100;
  return `${percent >= 10 || percent === 0 ? Math.round(percent) : percent.toFixed(1)}%`;
}

export function periodLabel(granularity: RetentionGranularity, period: number) {
  return `${granularity === "day" ? "Day" : "Week"} ${period}`;
}

/** Cohort label in UTC: "Nov 18" for days, "Nov 16 – 22" for weeks. */
export function formatCohort(start: string, granularity: RetentionGranularity) {
  const date = new Date(start);
  const utc = new Date(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  );
  if (granularity === "day") return format(utc, "MMM d");
  const last = new Date(utc);
  last.setDate(last.getDate() + 6);
  return last.getMonth() === utc.getMonth()
    ? `${format(utc, "MMM d")} – ${format(last, "d")}`
    : `${format(utc, "MMM d")} – ${format(last, "MMM d")}`;
}

/** Background for a heat cell: the brand colour at an opacity tied to the rate. */
export function heatBackground(rate: number) {
  const alpha = rate <= 0 ? 0 : 0.08 + Math.min(rate, 1) * 0.82;
  const hex = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, "0");
  return `${RETENTION_COLOR}${hex}`;
}

/** Hatched fill for periods that have not ended yet. */
export const PARTIAL_BACKGROUND =
  "repeating-linear-gradient(135deg, #f4f2ee 0 4px, #ffffff 4px 8px)";
