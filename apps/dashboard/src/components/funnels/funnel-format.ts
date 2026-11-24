import { formatLagDuration } from "@/lib/lag-duration";

/** Median step time, e.g. "8.3 hours"; an em dash without samples. */
export function formatMedian(seconds: number | null) {
  if (seconds === null) return "—";
  const { value, unit } = formatLagDuration(seconds);
  return `${value} ${unit}`;
}

export const windowLabels = {
  "1h": "1 hour",
  "1d": "1 day",
  "7d": "7 days",
  "30d": "30 days",
} as const;

export const breakdownLabels = {
  platform: "Platform",
  country: "Country",
  app_version: "App version",
  source: "Source",
} as const;
