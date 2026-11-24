import type { AppVersionSeries } from "@logly/utils";

// Newest release takes the brand green; older releases step through distinct
// hues; Other and Unknown stay neutral so they never read as a release.
const VERSION_COLORS = [
  "#347b56",
  "#2f6fb0",
  "#c27a2c",
  "#8a5bb5",
  "#c0504d",
  "#3a9a9a",
  "#a3883a",
  "#6b7a8f",
];

export function versionColor(series: Pick<AppVersionSeries, "key" | "kind">) {
  if (series.kind === "other") return "#b9b4aa";
  if (series.kind === "unknown") return "#dedad2";
  const index = Number(series.key.slice(1));
  return VERSION_COLORS[index % VERSION_COLORS.length] ?? "#6b7a8f";
}
