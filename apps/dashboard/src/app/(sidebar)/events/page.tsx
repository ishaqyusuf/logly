import type { AnalyticsEventQuery } from "@logly/utils";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { SearchParams } from "nuqs/server";
import { Suspense } from "react";
import { EventsWorkspace } from "@/components/events-workspace";
import { ScrollableContent } from "@/components/scrollable-content";
import { EventSkeleton } from "@/components/tables/events/skeleton";
import { loadEventFilterParams } from "@/hooks/use-event-filter-params";
import {
  getDashboardEventOptions,
  getDashboardEventPage,
  getDashboardEventSummary,
} from "@/lib/dashboard-data";
import { projectWorkspaceHref } from "@/lib/project-workspace";
import { loadProjectWorkspace } from "@/lib/project-workspace-server";

export const metadata: Metadata = { title: "Events" };
export const dynamic = "force-dynamic";

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const rawSearchParams = await searchParams;
  const workspace = await loadProjectWorkspace({
    pathname: "/events",
    searchParams: rawSearchParams,
  });
  if (!workspace.project) throw new Error("A project workspace is required");
  if (typeof rawSearchParams.start !== "string") {
    redirect(
      projectWorkspaceHref("/events", workspace, {
        ...rawSearchParams,
        start: new Date(Date.now() - 7 * 86_400_000).toISOString(),
      }),
    );
  }
  const params = await loadEventFilterParams(rawSearchParams);
  const sources = params.sources?.filter(
    (source): source is "browser" | "server" | "mobile" =>
      source === "browser" || source === "server" || source === "mobile",
  );
  const platforms = params.platforms?.filter(
    (platform): platform is "web" | "ios" | "android" =>
      platform === "web" || platform === "ios" || platform === "android",
  );
  const query: AnalyticsEventQuery = {
    organization: workspace.organization?.slug,
    project: workspace.project.slug,
    names: params.names ?? undefined,
    sources,
    platforms,
    q: params.q ?? undefined,
    start: params.start ?? undefined,
    end: params.end ?? undefined,
    sort: params.sort as AnalyticsEventQuery["sort"],
    pageSize: 50,
  };
  const [initialPage, options, initialSummary] = await Promise.all([
    getDashboardEventPage(query),
    getDashboardEventOptions({
      organization: workspace.organization?.slug,
      project: workspace.project.slug,
    }),
    getDashboardEventSummary(query),
  ]);

  return (
    <ScrollableContent>
      <div className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Event stream
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em]">
              Every signal in {workspace.project.name}
            </h2>
          </div>
          <p className="hidden max-w-sm text-right text-xs leading-5 text-muted-foreground lg:block">
            Search, filter, sort, resize, reorder, and inspect immutable events
            as they arrive.
          </p>
        </div>
        <Suspense fallback={<EventSkeleton />}>
          <EventsWorkspace
            initialPage={initialPage}
            options={options}
            initialSummary={initialSummary}
            projectName={workspace.project.name}
            scope={{
              organization: workspace.organization?.slug,
              project: workspace.project.slug,
            }}
          />
        </Suspense>
      </div>
    </ScrollableContent>
  );
}
