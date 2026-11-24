"use client";

import { Badge } from "@logly/ui/badge";
import { BrandMark, brandColor } from "@logly/ui/brand";
import { Button } from "@logly/ui/button";
import type {
  AnalyticsOrganizationSummary,
  AnalyticsProjectSummary,
} from "@logly/utils";
import { CircleHelp } from "lucide-react";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@/components/sign-out-button";
import { WorkspaceSelector } from "@/components/workspace-selector";

const titles: Record<string, { title: string; description: string }> = {
  "/overview": {
    title: "Overview",
    description: "Signals, visitors, and collection health at a glance",
  },
  "/events": {
    title: "Events",
    description: "Compare event names and inspect accepted signals",
  },
  "/pages": {
    title: "Pages",
    description: "Top, entry, and exit pages or app screens",
  },
  "/versions": {
    title: "Versions",
    description: "How fast each mobile app release reaches active users",
  },
  "/retention": {
    title: "Retention",
    description: "How many users come back after their first visit",
  },
  "/funnels": {
    title: "Funnels",
    description: "Ordered steps per visitor, with drop-off and step times",
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
  organizations,
  projects,
  user,
}: {
  mode: "demo" | "database";
  organizations: AnalyticsOrganizationSummary[];
  projects: AnalyticsProjectSummary[];
  user: { email: string; name: string };
}) {
  const pathname = usePathname();
  const page = titles[pathname] ?? {
    title: "Overview",
    description: "Signals, visitors, and collection health at a glance",
  };

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 px-4 backdrop-blur-xl md:px-8">
      <div className="mx-auto flex h-[72px] max-w-[1500px] items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="shrink-0 md:hidden"
              role="img"
              aria-label="Logly"
              style={{ color: brandColor }}
            >
              <BrandMark size={24} />
            </span>
            <WorkspaceSelector
              organizations={organizations}
              projects={projects}
            />
          </div>
          <span className="hidden h-6 border-l border-border lg:block" />
          <div className="hidden min-w-0 lg:block">
            <h1 className="truncate text-xs font-semibold">{page.title}</h1>
            <p className="truncate text-[11px] text-muted-foreground">
              {page.description}
            </p>
          </div>
          {mode === "demo" && (
            <Badge variant="warning" className="hidden sm:inline-flex">
              Demo data
            </Badge>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <Badge variant="outline" className="hidden sm:inline-flex">
            {mode === "database" ? "Stored event data" : "Demo data"}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Help"
            className="hidden sm:inline-flex"
          >
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
