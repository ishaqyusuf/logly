import type { AnalyticsOverviewRange } from "@logly/utils";
import type { Metadata, Route } from "next";
import type { SearchParams } from "nuqs/server";
import { OverviewCollectionHealth } from "@/components/overview/overview-collection-health";
import { OverviewMetrics } from "@/components/overview/overview-metrics";
import { OverviewRecentEvents } from "@/components/overview/overview-recent-events";
import { OverviewStatus } from "@/components/overview/overview-status";
import { OverviewTopEvents } from "@/components/overview/overview-top-events";
import { OverviewRangeFilter } from "@/components/overview-range-filter";
import { ScrollableContent } from "@/components/scrollable-content";
import { loadProjectWorkspace } from "@/lib/project-workspace-server";

export const metadata: Metadata = { title: "Overview" };
export const dynamic = "force-dynamic";

const windowLabels: Record<
  AnalyticsOverviewRange,
  { current: string; previous: string }
> = {
  "24h": { current: "last 24 hours", previous: "Previous 24 hours" },
  "7d": { current: "last 7 days", previous: "Previous 7 days" },
  "30d": { current: "last 30 days", previous: "Previous 30 days" },
};

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const range: AnalyticsOverviewRange =
    params.range === "24h" || params.range === "30d" ? params.range : "7d";
  const workspace = await loadProjectWorkspace({
    pathname: "/overview",
    searchParams: params,
    overviewRange: range,
  });
  if (!workspace.project) throw new Error("A project workspace is required");
  const { data, project } = workspace;
  const scope = new URLSearchParams();
  if (workspace.organization)
    scope.set("organization", workspace.organization.slug);
  scope.set("project", project.slug);
  const eventsHref = `/events?${scope}` as Route;
  const labels = windowLabels[range];

  return (
    <ScrollableContent>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
            <h2 className="text-xl font-semibold tracking-[-0.025em]">
              {project.name}
            </h2>
            <OverviewStatus project={project} />
          </div>
          <OverviewRangeFilter range={range} query={scope.toString()} />
        </div>
        <OverviewMetrics
          overview={data.overview}
          windowLabel={labels.current}
          previousLabel={labels.previous}
        />
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <OverviewTopEvents
            events={data.overview.topEvents ?? []}
            previousLabel={labels.previous}
            href={eventsHref}
          />
          <OverviewRecentEvents
            events={data.events.slice(0, 6)}
            href={eventsHref}
          />
          <OverviewCollectionHealth
            health={data.overview.collectionHealth}
            mode={data.mode}
            className="md:col-span-2 xl:col-span-1"
          />
        </div>
      </div>
    </ScrollableContent>
  );
}
