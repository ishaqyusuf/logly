import { useQueryState } from "nuqs";
import { parseAsStringLiteral } from "nuqs/server";

export const overviewMetrics = [
  "visitors",
  "new",
  "returning",
  "events",
] as const;
export type OverviewMetric = (typeof overviewMetrics)[number];

export const overviewParamsSchema = {
  metric: parseAsStringLiteral(overviewMetrics).withDefault("visitors"),
};

export function useOverviewParams() {
  const [metric, setMetric] = useQueryState(
    "metric",
    overviewParamsSchema.metric.withOptions({
      history: "replace",
      shallow: true,
    }),
  );
  return { metric, setMetric };
}
