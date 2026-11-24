import { auth } from "@logly/auth";
import {
  type AnalyticsFunnel,
  normalizeFunnelQuery,
  serializeFunnelSteps,
} from "@logly/utils";
import type { Metadata } from "next";
import { headers } from "next/headers";
import type { SearchParams } from "nuqs/server";
import { FunnelBuilder } from "@/components/funnels/funnel-builder";
import { FunnelResults } from "@/components/funnels/funnel-results";
import { SavedFunnels } from "@/components/funnels/saved-funnels";
import { ScrollableContent } from "@/components/scrollable-content";
import { getDashboardFunnel, getFunnelOptions } from "@/lib/dashboard-data";
import { FUNNEL_RANGES, readFunnelParams } from "@/lib/funnel-params";
import { loadProjectWorkspace } from "@/lib/project-workspace-server";

export const metadata: Metadata = { title: "Funnels" };
export const dynamic = "force-dynamic";

export default async function FunnelsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const workspace = await loadProjectWorkspace({
    pathname: "/funnels",
    searchParams: params,
  });
  const { project, organization } = workspace;
  if (!project) throw new Error("A project workspace is required");
  const [session, options] = await Promise.all([
    auth.api.getSession({ headers: await headers() }),
    getFunnelOptions(project.slug),
  ]);
  const state = readFunnelParams(params, options.funnels);
  let report: AnalyticsFunnel | null = null;
  let error = state.error;
  if (state.steps && !error) {
    try {
      const query = normalizeFunnelQuery({
        project: project.slug,
        organization: organization?.slug,
        steps: state.steps,
        window: state.window,
        start: new Date(
          Date.now() - FUNNEL_RANGES[state.range] * 86_400_000,
        ).toISOString(),
        breakdown: state.breakdown ?? undefined,
      });
      report = await getDashboardFunnel(query);
    } catch (cause) {
      error = cause instanceof Error ? cause.message : "Could not run funnel";
    }
  }
  const scope = new URLSearchParams();
  if (organization) scope.set("organization", organization.slug);
  scope.set("project", project.slug);
  const canEdit =
    session?.user.role === "admin" && workspace.mode === "database";

  return (
    <ScrollableContent>
      <div className="space-y-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Funnels
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-[-0.025em]">
            Where {project.name} visitors drop off
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick 2 to 8 ordered events. Each visitor counts once per step.
          </p>
        </div>
        <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
          <SavedFunnels
            scope={scope.toString()}
            funnels={options.funnels}
            selected={state.saved?.id ?? null}
          />
          <div className="flex min-w-0 flex-col gap-5">
            <FunnelBuilder
              key={`${state.saved?.id ?? "new"}:${state.steps ? serializeFunnelSteps(state.steps) : ""}`}
              scope={scope.toString()}
              project={project.slug}
              events={options.events}
              routes={options.routes}
              saved={state.saved}
              initialSteps={state.steps}
              initialWindow={state.window}
              initialRange={state.range}
              initialBreakdown={state.breakdown}
              canEdit={canEdit}
            />
            {error ? (
              <p
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
              >
                {error}
              </p>
            ) : null}
            {report ? <FunnelResults report={report} /> : null}
            {!report && !error ? (
              <p className="rounded-xl border border-dashed bg-white p-6 text-sm text-muted-foreground">
                Choose at least two events and run the funnel. A visitor enters
                at their first step-1 event in the date range; each later step
                must follow the previous one within the conversion window.
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Counts project-scoped visitor IDs from browser, mobile and server
              events. Events without a visitor ID are excluded. Repeating a step
              needs a separate, later event. Up to {(50_000).toLocaleString()}{" "}
              entrants are followed per run.
            </p>
          </div>
        </div>
      </div>
    </ScrollableContent>
  );
}
