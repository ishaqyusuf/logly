"use client";

import type { AnalyticsRelease, AnalyticsTrendGranularity } from "@logly/utils";
import { format, parseISO } from "date-fns";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ReleaseTooltipList,
  releaseMarkerLines,
  useReleaseGroups,
} from "@/components/charts/release-markers";

export type OverviewTrendDatum = {
  date: string;
  current: number;
  previous?: number;
};

function parseBucket(value: string) {
  return parseISO(value);
}

function formatTick(value: string, granularity: AnalyticsTrendGranularity) {
  const date = parseBucket(value);
  // Hour buckets are UTC; show the UTC hour so axis labels match bucket keys.
  return granularity === "hour"
    ? `${String(date.getUTCHours()).padStart(2, "0")}:00`
    : format(date, "MMM d");
}

function formatTooltipLabel(
  value: string,
  granularity: AnalyticsTrendGranularity,
) {
  const date = parseBucket(value);
  return granularity === "hour"
    ? `${format(date, "MMM d")} · ${String(date.getUTCHours()).padStart(2, "0")}:00 UTC`
    : format(date, "MMM d, yyyy");
}

function TrendTooltip({
  active,
  payload,
  label,
  granularity,
  metricLabel,
  releases,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ dataKey?: unknown; value?: unknown }>;
  label?: unknown;
  granularity: AnalyticsTrendGranularity;
  metricLabel: string;
  releases?: AnalyticsRelease[];
}) {
  if (!active || !payload?.length) return null;
  const current = payload.find((item) => item.dataKey === "current")?.value;
  const previous = payload.find((item) => item.dataKey === "previous")?.value;
  return (
    <div className="min-w-[150px] rounded-[10px] border border-[#e3dfd8] bg-white px-3 py-2 text-xs shadow-[0_12px_32px_rgba(16,16,16,.08)]">
      <p className="mb-1.5 text-[11px] text-muted-foreground">
        {formatTooltipLabel(String(label), granularity)}
      </p>
      <p className="flex items-center justify-between gap-4">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="size-2 rounded-[2px] bg-[#347b56]" />
          {metricLabel}
        </span>
        <span className="font-medium tabular-nums">
          {Number(current ?? 0).toLocaleString()}
        </span>
      </p>
      {typeof previous === "number" ? (
        <p className="mt-0.5 flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="size-2 rounded-[2px] bg-[#9a958c]/60" />
            Previous period
          </span>
          <span className="tabular-nums">{previous.toLocaleString()}</span>
        </p>
      ) : null}
      <ReleaseTooltipList releases={releases} />
    </div>
  );
}

export function OverviewTrendChart({
  data,
  granularity,
  metricLabel,
  releases,
  height = 300,
}: {
  data: OverviewTrendDatum[];
  granularity: AnalyticsTrendGranularity;
  metricLabel: string;
  /** Deploy markers; each is drawn on the bucket it falls in. */
  releases?: AnalyticsRelease[];
  height?: number;
}) {
  const releaseGroups = useReleaseGroups(
    releases,
    data.map((point) => point.date),
    granularity,
  );
  const hasPrevious = data.some((point) => point.previous !== undefined);
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{
            top: releaseGroups.size ? 16 : 10,
            right: 4,
            left: -24,
            bottom: 0,
          }}
          accessibilityLayer
        >
          <defs>
            <linearGradient
              id="overview-trend-fill"
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor="#347b56" stopOpacity={0.22} />
              <stop offset="100%" stopColor="#347b56" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="#e8e5df"
          />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "#77736c" }}
            tickFormatter={(value) => formatTick(String(value), granularity)}
            minTickGap={24}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "#77736c" }}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ stroke: "#cfcac0" }}
            content={(props) => (
              <TrendTooltip
                {...props}
                granularity={granularity}
                metricLabel={metricLabel}
                releases={releaseGroups.get(String(props.label))}
              />
            )}
          />
          {releaseMarkerLines(releaseGroups)}
          {hasPrevious ? (
            <Line
              type="monotone"
              dataKey="previous"
              stroke="#9a958c"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
              activeDot={false}
              isAnimationActive={false}
            />
          ) : null}
          <Area
            type="monotone"
            dataKey="current"
            stroke="#347b56"
            strokeWidth={2}
            fill="url(#overview-trend-fill)"
            activeDot={{ r: 4, strokeWidth: 2, fill: "#fff" }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
