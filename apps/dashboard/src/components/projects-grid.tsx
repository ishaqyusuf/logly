"use client";

import { Badge } from "@logly/ui/badge";
import type { AnalyticsProjectSummary } from "@logly/utils";
import { formatDistanceToNowStrict } from "date-fns";
import { ArrowUpRight, Globe2, Radio } from "lucide-react";
import { useProjectParams } from "@/hooks/use-project-params";

const bars = [28, 42, 35, 58, 51, 66, 61, 77, 69, 84];

export function ProjectsGrid({
  projects,
}: {
  projects: AnalyticsProjectSummary[];
}) {
  const { setParams } = useProjectParams();
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {projects.map((project, projectIndex) => (
        <button
          type="button"
          key={project.id}
          onClick={() =>
            void setParams({ projectId: project.id, projectType: "details" })
          }
          className="group rounded-xl border border-border bg-white p-5 text-left shadow-soft transition hover:-translate-y-0.5 hover:border-[#bfc9c1] hover:shadow-lg"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-[#f6f5f1] font-semibold text-[#347b56]">
                {project.name.slice(0, 1)}
              </div>
              <div>
                <h2 className="text-sm font-semibold">{project.name}</h2>
                <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                  {project.slug}
                </p>
              </div>
            </div>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground transition group-hover:text-foreground" />
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4 border-y border-border py-4">
            <div>
              <p className="text-[11px] text-muted-foreground">Events today</p>
              <p className="mt-1 text-xl font-medium tracking-[-0.03em]">
                {project.eventsToday.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Visitors</p>
              <p className="mt-1 text-xl font-medium tracking-[-0.03em]">
                {project.visitorsToday.toLocaleString()}
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-end justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <Globe2 className="h-3 w-3" />
                <span className="max-w-[170px] truncate">{project.origin}</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <Radio className="h-3 w-3" />
                {project.lastEventAt
                  ? formatDistanceToNowStrict(new Date(project.lastEventAt), {
                      addSuffix: true,
                    })
                  : "No events"}
              </div>
            </div>
            <div className="flex h-9 items-end gap-1" aria-hidden>
              {bars.map((height, index) => (
                <span
                  key={index}
                  className="w-1 rounded-sm bg-[#dce9df] last:bg-[#4f8c68]"
                  style={{
                    height: `${Math.max(14, height - projectIndex * 9)}%`,
                  }}
                />
              ))}
            </div>
          </div>
          <div className="mt-4">
            <Badge
              variant={project.status === "healthy" ? "success" : "warning"}
            >
              {project.status}
            </Badge>
          </div>
        </button>
      ))}
    </div>
  );
}
