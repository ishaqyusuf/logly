"use client";

import { cn } from "@logly/ui/cn";
import {
  type AnalyticsAppVersionsReport,
  type AnalyticsRelease,
  type AnalyticsTrendGranularity,
  type AppVersionSeries,
  releaseBucketKey,
} from "@logly/utils";
import { useState } from "react";
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
import { versionColor } from "./version-colors";
import { formatBucket, formatShare } from "./versions-format";

type Mode = "share" | "users";

function AdoptionTooltip({
  active,
  payload,
  label,
  granularity,
  series,
  totals,
  releases,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ dataKey?: unknown; value?: unknown }>;
  label?: unknown;
  granularity: AnalyticsTrendGranularity;
  series: AppVersionSeries[];
  totals: Map<string, number>;
  releases?: AnalyticsRelease[];
}) {
  if (!active || !payload?.length) return null;
  const total = totals.get(String(label)) ?? 0;
  const values = new Map(
    payload.map((item) => [String(item.dataKey), Number(item.value ?? 0)]),
  );
  return (
    <div className="min-w-[190px] rounded-[10px] border border-[#e3dfd8] bg-white px-3 py-2 text-xs shadow-[0_12px_32px_rgba(16,16,16,.08)]">
      <p className="mb-1.5 text-[11px] text-muted-foreground">
        {formatBucket(String(label), granularity, true)} ·{" "}
        {total.toLocaleString()} users
      </p>
      {series.map((entry) => {
        const users = values.get(entry.key) ?? 0;
        if (!users) return null;
        return (
          <p
            key={entry.key}
            className="flex items-center justify-between gap-4 py-px"
          >
            <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
              <span
                className="size-2 shrink-0 rounded-[2px]"
                style={{ background: versionColor(entry) }}
              />
              <span className="truncate font-mono">{entry.label}</span>
            </span>
            <span className="shrink-0 tabular-nums">
              {users.toLocaleString()}{" "}
              <span className="text-muted-foreground">
                {formatShare(total ? users / total : 0)}
              </span>
            </span>
          </p>
        );
      })}
      <ReleaseTooltipList releases={releases} />
    </div>
  );
}

/**
 * Stacked adoption over time. Share mode normalises each bucket to 100% so a
 * release's spread reads directly; users mode shows absolute active users.
 */
export function VersionsAdoptionChart({
  report,
  releases,
}: {
  report: Pick<AnalyticsAppVersionsReport, "series" | "trend" | "granularity">;
  /** Deploy markers (feature 2), drawn on the bucket each falls in. */
  releases?: AnalyticsRelease[];
}) {
  const [mode, setMode] = useState<Mode>("share");
  // Report buckets are full ISO strings; release groups use Pulse's bucket
  // keys, so map between the two.
  const bucketByReleaseKey = new Map(
    report.trend.map((point) => [
      releaseBucketKey(point.bucket, report.granularity),
      point.bucket,
    ]),
  );
  const releaseKeyGroups = useReleaseGroups(
    releases,
    [...bucketByReleaseKey.keys()],
    report.granularity,
  );
  const releaseGroups = new Map(
    [...releaseKeyGroups].map(([key, list]) => [
      bucketByReleaseKey.get(key) ?? key,
      list,
    ]),
  );
  const data = report.trend.map((point) => ({
    bucket: point.bucket,
    ...point.values,
  }));
  const totals = new Map(
    report.trend.map((point) => [point.bucket, point.total]),
  );
  // Recharts stacks in render order: Unknown and Other at the bottom, the
  // newest release on top.
  const stack = [...report.series].reverse();
  const hasData = report.trend.some((point) => point.total > 0);

  return (
    <section className="overflow-hidden rounded-xl border bg-white shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3 px-[18px] pb-2 pt-4">
        <div>
          <h3 className="text-[13px] font-semibold">Adoption over time</h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Active users on each version per{" "}
            {report.granularity === "hour" ? "hour" : "day"} (UTC), by the
            version of their latest event
          </p>
        </div>
        <fieldset className="m-0 flex items-center rounded-lg border bg-white p-1">
          <legend className="sr-only">Chart scale</legend>
          {(["share", "users"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={mode === option}
              onClick={() => setMode(option)}
              className={cn(
                "inline-flex h-7 items-center rounded-md px-2.5 text-xs font-medium",
                mode === option
                  ? "border bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {option === "share" ? "Share" : "Users"}
            </button>
          ))}
        </fieldset>
      </div>
      {hasData ? (
        <div className="h-[280px] w-full px-2 pb-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              stackOffset={mode === "share" ? "expand" : "none"}
              margin={{ top: 10, right: 12, left: -16, bottom: 0 }}
              accessibilityLayer
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#e8e5df"
              />
              <XAxis
                dataKey="bucket"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#77736c" }}
                tickFormatter={(value) =>
                  formatBucket(String(value), report.granularity)
                }
                minTickGap={24}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#77736c" }}
                allowDecimals={mode === "share"}
                domain={mode === "share" ? [0, 1] : [0, "auto"]}
                ticks={mode === "share" ? [0, 0.25, 0.5, 0.75, 1] : undefined}
                tickFormatter={(value: number) =>
                  mode === "share" ? `${Math.round(value * 100)}%` : `${value}`
                }
              />
              <Tooltip
                cursor={{ stroke: "#cfcac0" }}
                content={(props) => (
                  <AdoptionTooltip
                    {...props}
                    granularity={report.granularity}
                    series={report.series}
                    totals={totals}
                    releases={releaseGroups.get(String(props.label))}
                  />
                )}
              />
              {stack.map((entry) => (
                <Area
                  key={entry.key}
                  type="linear"
                  dataKey={entry.key}
                  name={entry.label}
                  stackId="versions"
                  stroke={versionColor(entry)}
                  fill={versionColor(entry)}
                  fillOpacity={entry.kind === "version" ? 0.55 : 0.8}
                  strokeWidth={1.25}
                  isAnimationActive={false}
                />
              ))}
              {releaseMarkerLines(releaseGroups)}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="mx-[18px] mb-4 rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
          No identified app users in this range.
        </p>
      )}
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 border-t px-[18px] py-3">
        {report.series.map((entry) => (
          <li
            key={entry.key}
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
          >
            <span
              className="size-2 rounded-[2px]"
              style={{ background: versionColor(entry) }}
            />
            <span className={entry.kind === "version" ? "font-mono" : ""}>
              {entry.label}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
