import type { AnalyticsOverviewRange } from "@logly/utils";
import { Smartphone } from "lucide-react";
import type { Metadata } from "next";
import type { SearchParams } from "nuqs/server";
import { ScrollableContent } from "@/components/scrollable-content";
import { VersionsAdoptionChart } from "@/components/versions/versions-adoption-chart";
import { VersionsMetrics } from "@/components/versions/versions-metrics";
import { VersionsPlatforms } from "@/components/versions/versions-platforms";
import { VersionsRangeFilter } from "@/components/versions/versions-range-filter";
import { VersionsTable } from "@/components/versions/versions-table";
import { getDashboardAppVersions } from "@/lib/dashboard-data";
import { loadProjectWorkspace } from "@/lib/project-workspace-server";

export const metadata: Metadata = { title: "Versions" };
export const dynamic = "force-dynamic";

export default async function VersionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const range: AnalyticsOverviewRange =
    params.range === "24h" || params.range === "30d" ? params.range : "7d";
  const workspace = await loadProjectWorkspace({
    pathname: "/versions",
    searchParams: params,
  });
  const { project, organization } = workspace;
  if (!project) throw new Error("A project workspace is required");
  const report = await getDashboardAppVersions({
    project: project.slug,
    organization: organization?.slug,
    range,
  });
  const scope = new URLSearchParams();
  if (organization) scope.set("organization", organization.slug);
  scope.set("project", project.slug);

  return (
    <ScrollableContent>
      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              App versions
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-[-0.025em]">
              How fast releases reach {project.name} users
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Mobile events by <span className="font-mono">appVersion</span>.
              Each user counts once, on the version of their latest event.
            </p>
          </div>
          {report.mobile ? (
            <VersionsRangeFilter query={scope.toString()} range={range} />
          ) : null}
        </div>
        {report.mobile ? (
          <>
            <VersionsMetrics report={report} />
            <VersionsAdoptionChart report={report} />
            <VersionsTable versions={report.versions} />
            <VersionsPlatforms
              platforms={report.platforms}
              activeUsers={report.totals.activeUsers}
            />
          </>
        ) : (
          <section className="flex flex-col items-center rounded-xl border border-dashed bg-white px-6 py-12 text-center">
            <Smartphone className="size-6 text-muted-foreground" />
            <h3 className="mt-3 text-sm font-semibold">
              No mobile app data for {project.name}
            </h3>
            <p className="mt-1 max-w-md text-xs text-muted-foreground">
              Version adoption appears once an iOS or Android app sends events
              with <span className="font-mono">source: "mobile"</span>. Nothing
              arrived in the last {report.lookbackDays} days, so this looks like
              a web-only project. Mobile apps should use{" "}
              <span className="font-mono">@ishaqyusuf/logly-native</span> with{" "}
              <span className="font-mono">appVersion</span> and{" "}
              <span className="font-mono">appBuild</span> set.
            </p>
          </section>
        )}
      </div>
    </ScrollableContent>
  );
}
