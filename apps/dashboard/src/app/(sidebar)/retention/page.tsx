import {
  isRetentionRange,
  isRetentionSurface,
  normalizeRetentionReturnEvent,
  type RetentionRange,
  type RetentionSurface,
  retentionWindow,
} from "@logly/utils";
import { Info, Repeat } from "lucide-react";
import type { Metadata } from "next";
import type { SearchParams } from "nuqs/server";
import { RetentionCurve } from "@/components/retention/retention-curve";
import { RetentionFilters } from "@/components/retention/retention-filters";
import { RetentionGrid } from "@/components/retention/retention-grid";
import { RetentionMetrics } from "@/components/retention/retention-metrics";
import { ScrollableContent } from "@/components/scrollable-content";
import {
  getDashboardEventOptions,
  getDashboardRetention,
  getReleases,
} from "@/lib/dashboard-data";
import { loadProjectWorkspace } from "@/lib/project-workspace-server";

export const metadata: Metadata = { title: "Retention" };
export const dynamic = "force-dynamic";

export default async function RetentionPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const range: RetentionRange = isRetentionRange(params.range)
    ? params.range
    : "30d";
  const surface: RetentionSurface = isRetentionSurface(params.surface)
    ? params.surface
    : "all";
  const returnEvent = normalizeRetentionReturnEvent(params.event);
  const workspace = await loadProjectWorkspace({
    pathname: "/retention",
    searchParams: params,
  });
  const { project, organization } = workspace;
  if (!project) throw new Error("A project workspace is required");
  const window = retentionWindow(range, new Date());
  const [report, options, releases] = await Promise.all([
    getDashboardRetention({
      project: project.slug,
      organization: organization?.slug,
      range,
      surface,
      returnEvent,
    }),
    getDashboardEventOptions({
      project: project.slug,
      organization: organization?.slug,
    }),
    getReleases({
      project: project.slug,
      start: window.start.toISOString(),
      environment: "production",
    }),
  ]);
  const scope = new URLSearchParams();
  if (organization) scope.set("organization", organization.slug);
  scope.set("project", project.slug);
  const hasEntries = report.surfaces.web || report.surfaces.mobile;

  return (
    <ScrollableContent>
      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Retention
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-[-0.025em]">
              How many {project.name} users come back
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Cohorts by first <span className="font-mono">site_visit</span> or{" "}
              <span className="font-mono">app_session</span>; returning means{" "}
              {returnEvent ? (
                <span className="font-mono">{returnEvent}</span>
              ) : (
                "any event"
              )}{" "}
              in a later {report.granularity}.
            </p>
          </div>
          {hasEntries ? (
            <RetentionFilters
              query={scope.toString()}
              range={range}
              surface={surface}
              returnEvent={returnEvent}
              showSurfaces={
                (report.surfaces.web && report.surfaces.mobile) ||
                surface !== "all"
              }
              eventNames={options.names}
            />
          ) : null}
        </div>
        {hasEntries ? (
          <>
            <RetentionMetrics report={report} />
            <RetentionCurve report={report} />
            <RetentionGrid report={report} releases={releases} />
            <aside className="flex gap-2.5 rounded-xl border bg-[#faf9f6] px-[18px] py-3 text-[11px] leading-relaxed text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              <p>
                <span className="font-medium text-foreground">
                  These rates are a lower bound.
                </span>{" "}
                A user is a per-project visitor ID, which is per browser or app
                install and resets when storage is cleared. Someone who comes
                back on another device, in a private window, or after clearing
                data counts as a new user, so real retention is at least this
                high. A visitor first seen more than {report.lookbackDays} days
                before the oldest cohort can also reappear as new.
              </p>
            </aside>
          </>
        ) : (
          <section className="flex flex-col items-center rounded-xl border border-dashed bg-white px-6 py-12 text-center">
            <Repeat className="size-6 text-muted-foreground" />
            <h3 className="mt-3 text-sm font-semibold">
              No visits recorded for {project.name}
            </h3>
            <p className="mt-1 max-w-md text-xs text-muted-foreground">
              Retention starts from a visitor's first{" "}
              <span className="font-mono">site_visit</span> (web SDK) or{" "}
              <span className="font-mono">app_session</span> (mobile SDK).
              Neither arrived in the last {report.lookbackDays} days.
            </p>
          </section>
        )}
      </div>
    </ScrollableContent>
  );
}
