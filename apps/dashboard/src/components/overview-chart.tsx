"use client";

import type { AnalyticsRelease, AnalyticsTrendPoint } from "@logly/utils";
import { format, parseISO } from "date-fns";
import {
  Area,
  AreaChart,
  CartesianGrid,
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

export function OverviewChart({
  data,
  releases,
  height = 280,
}: {
  data: AnalyticsTrendPoint[];
  /** Deploy markers, drawn on the day they fall in. */
  releases?: AnalyticsRelease[];
  height?: number;
}) {
  const releaseGroups = useReleaseGroups(
    releases,
    data.map((point) => point.date),
    "day",
  );
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{
            top: releaseGroups.size ? 16 : 10,
            right: 4,
            left: -24,
            bottom: 0,
          }}
        >
          <defs>
            <linearGradient id="events-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#347b56" stopOpacity={0.24} />
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
            tickFormatter={(value) => format(parseISO(value), "MMM d")}
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
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <div className="min-w-[140px] rounded-[10px] border border-[#e3dfd8] bg-white px-3 py-2 text-xs shadow-[0_12px_32px_rgba(16,16,16,.08)]">
                  <p className="mb-1.5 text-[11px] text-muted-foreground">
                    {format(parseISO(String(label)), "MMM d, yyyy")}
                  </p>
                  <p className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">Events</span>
                    <span className="font-medium tabular-nums">
                      {Number(payload[0]?.value ?? 0).toLocaleString()}
                    </span>
                  </p>
                  <ReleaseTooltipList
                    releases={releaseGroups.get(String(label))}
                  />
                </div>
              ) : null
            }
          />
          {releaseMarkerLines(releaseGroups)}
          <Area
            type="monotone"
            dataKey="events"
            stroke="#347b56"
            strokeWidth={2}
            fill="url(#events-fill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
