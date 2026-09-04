import { Badge } from "@logly/ui/badge";
import type { Metadata } from "next";
import type { SearchParams } from "nuqs/server";
import { ScrollableContent } from "@/components/scrollable-content";
import { getDashboardEventSummary } from "@/lib/dashboard-data";
import { loadProjectWorkspace } from "@/lib/project-workspace-server";

export const metadata: Metadata = { title: "Insights" };
export const dynamic = "force-dynamic";

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const workspace = await loadProjectWorkspace({
    pathname: "/insights",
    searchParams: params,
  });
  if (!workspace.project) throw new Error("A project workspace is required");
  const summary = await getDashboardEventSummary({
    organization: workspace.organization?.slug,
    project: workspace.project.slug,
    start: new Date(Date.now() - 30 * 86_400_000).toISOString(),
  });
  const totalSources = summary.sources.reduce(
    (total, source) => total + source.count,
    0,
  );
  return (
    <ScrollableContent>
      <div className="space-y-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Project insights
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em]">
            Patterns in {workspace.project.name}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Useful product signals from the last 30 days, without cross-project
            identity.
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <InsightList
            title="Top events"
            description="Highest-volume product signals"
            rows={summary.eventNames.slice(0, 8).map((event) => ({
              label: event.name,
              value: event.count,
              change: event.change,
            }))}
          />
          <InsightList
            title="Top routes"
            description="Where browser signals occur"
            rows={summary.routes
              .slice(0, 8)
              .map((route) => ({ label: route.route, value: route.count }))}
          />
        </div>
        <section className="rounded-xl border bg-white p-5 shadow-soft">
          <div className="mb-5">
            <p className="text-sm font-semibold">Source mix</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Browser and trusted server instrumentation
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {summary.sources.map((source) => (
              <div
                key={source.source}
                className="rounded-xl border bg-[#fbfaf7] p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm capitalize">{source.source}</span>
                  <Badge variant="outline">
                    {totalSources
                      ? Math.round((source.count / totalSources) * 100)
                      : 0}
                    %
                  </Badge>
                </div>
                <p className="mt-4 text-2xl font-medium tabular-nums">
                  {source.count.toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </ScrollableContent>
  );
}

function InsightList({
  title,
  description,
  rows,
}: {
  title: string;
  description: string;
  rows: Array<{ label: string; value: number; change?: number }>;
}) {
  const maximum = Math.max(...rows.map((row) => row.value), 1);
  return (
    <section className="rounded-xl border bg-white p-5 shadow-soft">
      <div className="mb-5">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="space-y-4">
        {rows.map((row) => (
          <div key={row.label}>
            <div className="mb-2 flex items-center gap-3">
              <span className="min-w-0 flex-1 truncate font-mono text-xs">
                {row.label}
              </span>
              {row.change !== undefined && (
                <span
                  className={
                    row.change >= 0
                      ? "text-xs text-emerald-700"
                      : "text-xs text-red-600"
                  }
                >
                  {row.change >= 0 ? "+" : ""}
                  {row.change}%
                </span>
              )}
              <span className="text-xs font-medium tabular-nums">
                {row.value.toLocaleString()}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-[#4f8c68]"
                style={{
                  width: `${Math.max(3, (row.value / maximum) * 100)}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
