import { type AnalyticsOverviewRange, parsePageViewEvent } from "@logly/utils";
import type { Metadata } from "next";
import type { SearchParams } from "nuqs/server";
import { PagesEdgeList } from "@/components/pages/pages-edge-list";
import { PagesFilters } from "@/components/pages/pages-filters";
import { PagesMetrics } from "@/components/pages/pages-metrics";
import { PagesTable } from "@/components/pages/pages-table";
import { ScrollableContent } from "@/components/scrollable-content";
import { getDashboardPages } from "@/lib/dashboard-data";
import { loadProjectWorkspace } from "@/lib/project-workspace-server";

export const metadata: Metadata = { title: "Pages" };
export const dynamic = "force-dynamic";

const previousLabels: Record<AnalyticsOverviewRange, string> = {
  "24h": "previous 24 hours",
  "7d": "previous 7 days",
  "30d": "previous 30 days",
};

export default async function PagesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const range: AnalyticsOverviewRange =
    params.range === "24h" || params.range === "30d" ? params.range : "7d";
  const requestedView = parsePageViewEvent(
    typeof params.view === "string" ? params.view : undefined,
  );
  const workspace = await loadProjectWorkspace({
    pathname: "/pages",
    searchParams: params,
  });
  const { project, organization } = workspace;
  if (!project) throw new Error("A project workspace is required");
  const report = await getDashboardPages({
    project: project.slug,
    organization: organization?.slug,
    range,
    view: requestedView,
  });
  const scope = new URLSearchParams();
  if (organization) scope.set("organization", organization.slug);
  scope.set("project", project.slug);
  const noun = report.view === "screen_view" ? "screen" : "page";

  return (
    <ScrollableContent>
      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              {noun === "screen" ? "Screens" : "Pages"}
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-[-0.025em]">
              Where people spend time in {project.name}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Routes from <span className="font-mono">{report.view}</span>{" "}
              events, as recorded. Older events may show raw paths or{" "}
              <span className="font-mono">/other</span>.
            </p>
          </div>
          <PagesFilters
            query={scope.toString()}
            range={range}
            view={report.view}
            requestedView={requestedView}
            available={report.available}
          />
        </div>
        <PagesMetrics
          totals={report.totals}
          noun={noun}
          previousLabel={previousLabels[range]}
        />
        <PagesTable
          pages={report.pages}
          noun={noun}
          previousLabel={previousLabels[range]}
        />
        <div className="grid gap-5 md:grid-cols-2">
          <PagesEdgeList
            title={`Entry ${noun}s`}
            description={`First ${noun} each visitor viewed per day`}
            rows={report.entries}
            total={report.totals.visitorDays}
          />
          <PagesEdgeList
            title={`Exit ${noun}s`}
            description={`Last ${noun} each visitor viewed per day`}
            rows={report.exits}
            total={report.totals.visitorDays}
          />
        </div>
      </div>
    </ScrollableContent>
  );
}
