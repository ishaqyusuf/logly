import { auth } from "@logly/auth";
import {
  EVENT_CATALOG_DEFAULT_STALE_DAYS,
  type EventCatalogRange,
  isEventCatalogRange,
  parseEventCatalogStaleDays,
} from "@logly/utils";
import type { Metadata } from "next";
import { headers } from "next/headers";
import type { SearchParams } from "nuqs/server";
import { CatalogFilters } from "@/components/event-catalog/catalog-filters";
import { CatalogMetrics } from "@/components/event-catalog/catalog-metrics";
import { CatalogTable } from "@/components/event-catalog/catalog-table";
import { ScrollableContent } from "@/components/scrollable-content";
import { getDashboardEventCatalog } from "@/lib/dashboard-data";
import { loadProjectWorkspace } from "@/lib/project-workspace-server";

export const metadata: Metadata = { title: "Event catalog" };
export const dynamic = "force-dynamic";

const previousLabels: Record<EventCatalogRange, string> = {
  "24h": "previous 24 hours",
  "7d": "previous 7 days",
  "30d": "previous 30 days",
};

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const range: EventCatalogRange = isEventCatalogRange(params.range)
    ? params.range
    : "7d";
  const staleDays =
    parseEventCatalogStaleDays(params.stale) ??
    EVENT_CATALOG_DEFAULT_STALE_DAYS;
  const workspace = await loadProjectWorkspace({
    pathname: "/catalog",
    searchParams: params,
  });
  const { project, organization } = workspace;
  if (!project) throw new Error("A project workspace is required");
  const [session, catalog] = await Promise.all([
    auth.api.getSession({ headers: await headers() }),
    getDashboardEventCatalog({
      project: project.slug,
      organization: organization?.slug,
      range,
      staleDays,
    }),
  ]);
  const scope = new URLSearchParams();
  if (organization) scope.set("organization", organization.slug);
  scope.set("project", project.slug);
  const canEdit =
    session?.user.role === "admin" && workspace.mode === "database";

  return (
    <ScrollableContent>
      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Event catalog
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-[-0.025em]">
              Every event name {project.name} sends
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Names are discovered from accepted events. Descriptions, owners
              and flags are notes for people: deprecating or hiding a name never
              changes its data.
            </p>
          </div>
          <CatalogFilters
            query={scope.toString()}
            range={range}
            staleDays={staleDays}
          />
        </div>
        <CatalogMetrics catalog={catalog} />
        <CatalogTable
          catalog={catalog}
          project={project.slug}
          canEdit={canEdit}
          previousLabel={previousLabels[range]}
        />
      </div>
    </ScrollableContent>
  );
}
