const units = [
  { limit: 60, size: 1, singular: "second", plural: "seconds" },
  { limit: 3_600, size: 60, singular: "minute", plural: "minutes" },
  { limit: 86_400, size: 3_600, singular: "hour", plural: "hours" },
  {
    limit: Number.POSITIVE_INFINITY,
    size: 86_400,
    singular: "day",
    plural: "days",
  },
] as const;

/**
 * Splits an arrival lag into a one-decimal value and its largest fitting unit,
 * e.g. 29769 → { value: "8.3", unit: "hours" }.
 */
export function formatLagDuration(seconds: number): {
  value: string;
  unit: string;
} {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  let unit = units.find((candidate) => safe < candidate.limit) ?? units[3];
  let value = Math.round((safe / unit.size) * 10) / 10;
  // Rounding can reach the next unit's threshold (59.97 seconds → 60.0).
  const next = units[units.indexOf(unit) + 1];
  if (next && value * unit.size >= unit.limit) {
    unit = next;
    value = Math.round((safe / unit.size) * 10) / 10;
  }
  return {
    value: value.toFixed(1),
    unit: value === 1 ? unit.singular : unit.plural,
  };
}
