"use client";

import type { AnalyticsRetentionReport } from "@logly/utils";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatRate, periodLabel, RETENTION_COLOR } from "./retention-format";

function CurveTooltip({
  active,
  payload,
  granularity,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{
    payload?: AnalyticsRetentionReport["average"][number];
  }>;
  granularity: AnalyticsRetentionReport["granularity"];
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="min-w-[180px] rounded-[10px] border border-[#e3dfd8] bg-white px-3 py-2 text-xs shadow-[0_12px_32px_rgba(16,16,16,.08)]">
      <p className="mb-1 text-[11px] text-muted-foreground">
        {periodLabel(granularity, point.period)}
      </p>
      <p className="text-sm font-medium tabular-nums">
        {formatRate(point.rate)}
      </p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        {point.rate === null
          ? "No cohort has finished this period yet"
          : `${point.users.toLocaleString()} of ${point.cohortUsers.toLocaleString()} users · ${point.cohorts} cohort${point.cohorts === 1 ? "" : "s"}`}
      </p>
    </div>
  );
}

/**
 * Average retention by period since first seen, weighted by cohort size and
 * limited to finished periods. The x axis is time since entry rather than a
 * date, so deploy markers live on the cohort rows instead of this chart.
 */
export function RetentionCurve({
  report,
}: {
  report: Pick<AnalyticsRetentionReport, "average" | "granularity">;
}) {
  // Every period stays on the axis; unfinished ones are gaps in the line.
  const data = report.average;
  const finished = data.filter((point) => point.rate !== null).length;
  const unit = report.granularity === "day" ? "day" : "week";
  return (
    <section className="overflow-hidden rounded-xl border bg-white shadow-soft">
      <div className="px-[18px] pb-2 pt-4">
        <h3 className="text-[13px] font-semibold">Average retention</h3>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Share of new users seen again each {unit} after their first, across
          cohorts that have finished that {unit}
        </p>
      </div>
      {finished > 1 ? (
        <div className="h-[220px] w-full px-2 pb-3">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 10, right: 16, left: -16, bottom: 0 }}
              accessibilityLayer
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#e8e5df"
              />
              <XAxis
                dataKey="period"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#77736c" }}
                tickFormatter={(value: number) =>
                  `${unit === "day" ? "D" : "W"}${value}`
                }
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#77736c" }}
                domain={[0, 1]}
                ticks={[0, 0.25, 0.5, 0.75, 1]}
                tickFormatter={(value: number) => `${Math.round(value * 100)}%`}
              />
              <Tooltip
                cursor={{ stroke: "#cfcac0" }}
                content={(props) => (
                  <CurveTooltip {...props} granularity={report.granularity} />
                )}
              />
              <Line
                type="linear"
                dataKey="rate"
                stroke={RETENTION_COLOR}
                strokeWidth={2}
                dot={{ r: 3, fill: RETENTION_COLOR, strokeWidth: 0 }}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="mx-[18px] mb-4 rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
          The curve appears once a cohort has finished its first {unit} after
          entry.
        </p>
      )}
    </section>
  );
}
