"use client";

import { Badge } from "@logly/ui/badge";
import { BrandMark, brandColor } from "@logly/ui/brand";
import { Button } from "@logly/ui/button";
import type { AnalyticsProjectSummary } from "@logly/utils";
import { CircleHelp } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { SignOutButton } from "@/components/sign-out-button";

const titles: Record<string, { title: string; description: string }> = {
  "/overview": {
    title: "Overview",
    description: "Signals, visitors, and collection health at a glance",
  },
  "/events": {
    title: "Events",
    description: "Compare event names and inspect accepted signals",
  },
  "/live": {
    title: "Live",
    description: "Watch the selected project's newest signals arrive",
  },
  "/insights": {
    title: "Insights",
    description: "Event, source, route, and visitor-day summaries",
  },
  "/settings": {
    title: "Settings",
    description: "Collector and privacy defaults",
  },
};

export function Header({
  mode,
  projects,
  user,
}: {
  mode: "demo" | "database";
  projects: AnalyticsProjectSummary[];
  user: { email: string; name: string };
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const project =
    projects.find((item) => item.slug === searchParams.get("project")) ??
    projects[0];
  const page = titles[pathname] ?? {
    title: "Overview",
    description: "Signals, visitors, and collection health at a glance",
  };

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 px-4 backdrop-blur-xl md:px-8">
      <div className="mx-auto flex h-[72px] max-w-[1500px] items-center justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span
              className="mr-1 shrink-0 md:hidden"
              role="img"
              aria-label="Logly"
              style={{ color: brandColor }}
            >
              <BrandMark size={24} />
            </span>
            {project ? (
              <>
                <span className="hidden sm:inline">
                  {project.organizationSlug}
                </span>
                <span className="hidden sm:inline">/</span>
                <strong className="truncate text-foreground">
                  {project.name}
                </strong>
                <span>/</span>
              </>
            ) : null}
            <h1 className="truncate text-xs font-medium text-muted-foreground">
              {page.title}
            </h1>
            {mode === "demo" && <Badge variant="warning">Demo data</Badge>}
          </div>
          <p className="mt-0.5 hidden text-xs text-muted-foreground sm:block">
            {page.description}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="hidden sm:inline-flex">
            {mode === "database" ? "Stored event data" : "Demo data"}
          </Badge>
          <Button variant="ghost" size="icon" aria-label="Help">
            <CircleHelp className="h-4 w-4" />
          </Button>
          <div className="md:hidden">
            <SignOutButton label={user.name || user.email} />
          </div>
        </div>
      </div>
    </header>
  );
}
