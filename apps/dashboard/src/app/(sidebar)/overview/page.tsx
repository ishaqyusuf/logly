import { Badge } from "@logly/ui/badge";
import { formatDistanceToNowStrict } from "date-fns";
import { Activity, ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { SearchParams } from "nuqs/server";
import { CollectionHealth } from "@/components/collection-health";
import { OverviewChart } from "@/components/overview-chart";
import { ScrollableContent } from "@/components/scrollable-content";
import { SummaryGrid } from "@/components/summary-grid";
import { loadProjectWorkspace } from "@/lib/project-workspace-server";

export const metadata: Metadata = { title: "Overview" };
export const dynamic = "force-dynamic";

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const workspace = await loadProjectWorkspace({
    pathname: "/overview",
    searchParams: params,
  });
  if (!workspace.project) throw new Error("A project workspace is required");
  const { data } = workspace;
  const query = new URLSearchParams();
  if (workspace.organization)
    query.set("organization", workspace.organization.slug);
  query.set("project", workspace.project.slug);
  return (
    <ScrollableContent>
      <div className="space-y-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Project overview
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em]">
            {workspace.project.name}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            A focused view of this project’s traffic and product signals.
          </p>
        </div>
        <SummaryGrid overview={data.overview} />
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,.75fr)]">
          <section className="rounded-xl border bg-white p-5 shadow-soft">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold">Event volume</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Signals received over the last 14 days
                </p>
              </div>
              <Badge variant="outline">14 days</Badge>
            </div>
            <OverviewChart data={data.overview.trend ?? []} />
          </section>
          <section className="overflow-hidden rounded-xl border bg-white shadow-soft">
            <div className="border-b p-5">
              <p className="text-sm font-semibold">Top events</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Highest-volume signals in this project
              </p>
            </div>
            <div className="divide-y">
              {data.overview.topEvents?.map((event, index) => (
                <div
                  key={event.name}
                  className="flex items-center gap-3 px-5 py-3.5"
                >
                  <span className="w-5 text-xs tabular-nums text-muted-foreground">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-mono text-xs">
                    {event.name}
                  </span>
                  <span className="text-xs font-medium tabular-nums">
                    {event.count.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,.75fr)]">
          <section className="overflow-hidden rounded-xl border bg-white shadow-soft">
            <div className="flex items-center justify-between border-b p-5">
              <div>
                <p className="text-sm font-semibold">Recent events</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  The newest signals in {workspace.project.name}
                </p>
              </div>
              <Link
                href={`/events${query.size ? `?${query}` : ""}`}
                className="flex items-center gap-1 text-xs font-medium text-[#347b56]"
              >
                View stream <ArrowRight className="size-3.5" />
              </Link>
            </div>
            <div className="divide-y">
              {data.events.slice(0, 6).map((event) => (
                <div
                  key={event.id}
                  className="flex items-center gap-3 px-5 py-3.5"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#edf3ee] text-[#347b56]">
                    <Activity className="size-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-xs font-medium">
                      {event.name}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {event.project}
                      {event.route ? ` · ${event.route}` : ""}
                    </p>
                  </div>
                  <span className="whitespace-nowrap text-[11px] text-muted-foreground">
                    {formatDistanceToNowStrict(new Date(event.occurredAt), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
              ))}
            </div>
          </section>
          <CollectionHealth
            health={data.overview.collectionHealth}
            mode={data.mode}
          />
        </div>
      </div>
    </ScrollableContent>
  );
}
