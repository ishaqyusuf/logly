import type { Metadata } from "next";
import type { SearchParams } from "nuqs/server";
import { LiveEvents } from "@/components/live-events";
import { ScrollableContent } from "@/components/scrollable-content";
import { getDashboardEventPage } from "@/lib/dashboard-data";
import { loadProjectWorkspace } from "@/lib/project-workspace-server";

export const metadata: Metadata = { title: "Live" };
export const dynamic = "force-dynamic";

export default async function LivePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const workspace = await loadProjectWorkspace({
    pathname: "/live",
    searchParams: params,
  });
  if (!workspace.project) throw new Error("A project workspace is required");
  const initialPage = await getDashboardEventPage({
    organization: workspace.organization?.slug,
    project: workspace.project.slug,
    start: new Date(Date.now() - 15 * 60_000).toISOString(),
    pageSize: 50,
  });
  return (
    <ScrollableContent>
      <div className="space-y-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Live activity
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em]">
            Watching {workspace.project.name}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            A short, focused window for validating instrumentation as it
            arrives.
          </p>
        </div>
        <LiveEvents
          initialPage={initialPage}
          organization={workspace.organization?.slug}
          project={workspace.project.slug}
        />
      </div>
    </ScrollableContent>
  );
}
