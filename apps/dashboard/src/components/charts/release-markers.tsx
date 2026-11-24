"use client";

import {
  type AnalyticsRelease,
  type AnalyticsTrendGranularity,
  groupReleasesByBucket,
} from "@logly/utils";
import { format } from "date-fns";
import { useMemo } from "react";
import { ReferenceLine } from "recharts";

export const RELEASE_MARKER_COLOR = "#b45309";
const TOOLTIP_RELEASE_LIMIT = 3;

/** Releases grouped by the chart bucket they fall in. */
export function useReleaseGroups(
  releases: AnalyticsRelease[] | undefined,
  buckets: string[],
  granularity: AnalyticsTrendGranularity,
) {
  const key = buckets.join("|");
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` stands in for `buckets`.
  return useMemo(
    () => groupReleasesByBucket(releases ?? [], buckets, granularity),
    [releases, key, granularity],
  );
}

function ReleaseFlag({
  viewBox,
  count,
}: {
  viewBox?: { x?: number; y?: number };
  count: number;
}) {
  const x = viewBox?.x ?? 0;
  const y = viewBox?.y ?? 0;
  return (
    <g pointerEvents="none">
      <path
        d={`M${x} ${y - 1} l5 5 l-5 5 l-5 -5 z`}
        fill={RELEASE_MARKER_COLOR}
        stroke="#fff"
        strokeWidth={1.5}
      />
      {count > 1 ? (
        <text
          x={x + 8}
          y={y + 8}
          fontSize={10}
          fontWeight={600}
          fill={RELEASE_MARKER_COLOR}
        >
          {count}
        </text>
      ) : null}
    </g>
  );
}

/**
 * Vertical deploy markers. Returned as an array of `ReferenceLine`s so they
 * render as direct chart children.
 */
export function releaseMarkerLines(groups: Map<string, AnalyticsRelease[]>) {
  return [...groups].map(([bucket, list]) => (
    <ReferenceLine
      key={`release-${bucket}`}
      x={bucket}
      stroke={RELEASE_MARKER_COLOR}
      strokeOpacity={0.7}
      strokeDasharray="3 3"
      label={<ReleaseFlag count={list.length} />}
      ifOverflow="hidden"
    />
  ));
}

/** Release lines for a chart tooltip: version, UTC time and description. */
export function ReleaseTooltipList({
  releases,
}: {
  releases: AnalyticsRelease[] | undefined;
}) {
  if (!releases?.length) return null;
  const shown = releases.slice(0, TOOLTIP_RELEASE_LIMIT);
  return (
    <div className="mt-2 space-y-1.5 border-t border-[#efece6] pt-2">
      {shown.map((release) => {
        const at = new Date(release.deployedAt);
        return (
          <div key={release.id} className="max-w-[240px]">
            <p className="flex items-center gap-1.5">
              <span
                className="size-2 rotate-45"
                style={{ background: RELEASE_MARKER_COLOR }}
              />
              <span className="truncate font-mono font-medium">
                {release.version}
              </span>
              {release.environment === "preview" ? (
                <span className="text-[10px] text-muted-foreground">
                  preview
                </span>
              ) : null}
              <span className="ml-auto shrink-0 text-[10px] text-muted-foreground tabular-nums">
                {format(at, "MMM d")} ·{" "}
                {`${String(at.getUTCHours()).padStart(2, "0")}:${String(at.getUTCMinutes()).padStart(2, "0")}`}{" "}
                UTC
              </span>
            </p>
            {release.description ? (
              <p className="mt-0.5 line-clamp-2 pl-3.5 text-[11px] text-muted-foreground">
                {release.description}
              </p>
            ) : null}
          </div>
        );
      })}
      {releases.length > shown.length ? (
        <p className="pl-3.5 text-[11px] text-muted-foreground">
          +{releases.length - shown.length} more releases
        </p>
      ) : null}
    </div>
  );
}
