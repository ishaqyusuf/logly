"use client";

import type { AnalyticsTrendPoint } from "@logly/utils";
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

export function OverviewChart({
  data,
  height = 280,
}: {
  data: AnalyticsTrendPoint[];
  height?: number;
}) {
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 10, right: 4, left: -24, bottom: 0 }}
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
            contentStyle={{
              border: "1px solid #e3dfd8",
              borderRadius: 10,
              boxShadow: "0 12px 32px rgba(16,16,16,.08)",
              fontSize: 12,
            }}
            labelFormatter={(value) =>
              format(parseISO(String(value)), "MMM d, yyyy")
            }
          />
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
