export function countryFlag(code: string) {
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) return "🌐";

  return String.fromCodePoint(
    ...[...normalized].map((character) => character.charCodeAt(0) + 127397),
  );
}

export function countryHeatOpacity(count: number, maximum: number) {
  const intensity = Math.sqrt(
    Math.min(1, Math.max(0, count / Math.max(1, maximum))),
  );
  return 0.3 + 0.7 * intensity;
}

export function formatVisitCount(count: number) {
  return `${count.toLocaleString("en-US")} ${count === 1 ? "visit" : "visits"}`;
}
