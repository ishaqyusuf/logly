import type { AnalyticsTrendGranularity } from "@logly/utils";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const pad = (value: number) => String(value).padStart(2, "0");

export function formatShare(share: number) {
  if (share === 0) return "0%";
  if (share < 0.001) return "<0.1%";
  return `${(share * 100).toFixed(share < 0.1 ? 1 : 0)}%`;
}

function utcDay(date: Date) {
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

/** Dates are shown in UTC, matching the report's UTC buckets. */
export function formatSeen(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return `${utcDay(date)} · ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

export function formatBucket(
  value: string,
  granularity: AnalyticsTrendGranularity,
  long = false,
) {
  const date = new Date(value);
  if (granularity === "day")
    return long ? `${utcDay(date)}, ${date.getUTCFullYear()}` : utcDay(date);
  const hour = `${pad(date.getUTCHours())}:00`;
  return long ? `${utcDay(date)} · ${hour} UTC` : hour;
}
