"use client";

import { useTrack } from "@ishaqyusuf/logly-next";
import { Badge } from "@logly/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@logly/ui/sheet";
import type {
  AnalyticsOrganizationSummary,
  AnalyticsProjectSummary,
} from "@logly/utils";
import { CheckCircle2, Copy, Database, Globe2, KeyRound } from "lucide-react";
import { useEffect } from "react";
import { ProjectCreateForm } from "@/components/forms/project-create-form";
import { useProjectParams } from "@/hooks/use-project-params";

export function ProjectSheet({
  organizations,
  projects,
  mode,
}: {
  organizations: AnalyticsOrganizationSummary[];
  projects: AnalyticsProjectSummary[];
  mode: "demo" | "database";
}) {
  const { projectId, projectType, setParams } = useProjectParams();
  const project = projects.find((item) => item.id === projectId);
  const open = projectType === "create" || projectType === "details";
  const track = useTrack();

  useEffect(() => {
    if (open) track("project_opened", { mode: projectType ?? "unknown" });
  }, [open, projectType, track]);

  return (
    <Sheet open={open} onOpenChange={(next) => !next && setParams(null)}>
      <SheetContent className="overflow-y-auto bg-[#fbfaf7] sm:max-w-[560px]">
        {projectType === "create" ? (
          <>
            <SheetHeader className="border-b border-border pb-6 pr-8">
              <SheetTitle>Connect a project</SheetTitle>
              <SheetDescription>
                Register an origin and create its isolated event namespace.
              </SheetDescription>
            </SheetHeader>
            <ProjectCreateForm
              disabled={mode === "demo"}
              organizations={organizations}
            />
          </>
        ) : project ? (
          <>
            <SheetHeader className="border-b border-border pb-6 pr-8">
              <div className="mb-2">
                <Badge
                  variant={project.status === "healthy" ? "success" : "warning"}
                >
                  {project.status}
                </Badge>
              </div>
              <SheetTitle>{project.name}</SheetTitle>
              <SheetDescription>{project.slug}</SheetDescription>
            </SheetHeader>
            <div className="space-y-6 py-7">
              <div className="overflow-hidden rounded-xl border border-border bg-white">
                <ProjectDetail
                  icon={Globe2}
                  label="Origin"
                  value={project.origin}
                />
                <ProjectDetail
                  icon={Database}
                  label="Events today"
                  value={String(project.eventsToday)}
                />
                <ProjectDetail
                  icon={CheckCircle2}
                  label="Visitors today"
                  value={String(project.visitorsToday)}
                  last
                />
              </div>
              <section>
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Install
                </p>
                <div className="relative rounded-xl border border-border bg-[#171a18] p-4 font-mono text-xs text-[#d5e7da]">
                  bun add @ishaqyusuf/logly-next
                  <button
                    type="button"
                    className="absolute right-3 top-3 rounded p-1.5 text-[#9eb2a4] hover:bg-white/10"
                    aria-label="Copy install command"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </section>
              <section>
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Credential scopes
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {["client-ingest", "server-write", "read", "admin"].map(
                    (scope) => (
                      <div
                        key={scope}
                        className="flex items-center gap-2 rounded-lg border border-border bg-white p-3 text-xs"
                      >
                        <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
                        {scope}
                      </div>
                    ),
                  )}
                </div>
              </section>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function ProjectDetail({
  icon: Icon,
  label,
  value,
  last = false,
}: {
  icon: typeof Globe2;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <div
      className={`grid grid-cols-[22px_120px_1fr] items-center gap-2 px-4 py-3 text-sm ${last ? "" : "border-b border-border"}`}
    >
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate text-right font-medium">{value}</span>
    </div>
  );
}
