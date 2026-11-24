"use client";

import { BrandMark, BrandWordmark, brandColor } from "@logly/ui/brand";
import { cn } from "@logly/ui/cn";
import type {
  AnalyticsOrganizationSummary,
  AnalyticsProjectSummary,
} from "@logly/utils";
import {
  Activity,
  BarChart3,
  FileText,
  LayoutDashboard,
  Radio,
  Repeat,
  Settings2,
  Smartphone,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { SignOutButton } from "@/components/sign-out-button";
import { resolveProjectWorkspace } from "@/lib/project-workspace";

const navigation = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/events", label: "Events", icon: Activity },
  { href: "/pages", label: "Pages", icon: FileText },
  { href: "/versions", label: "Versions", icon: Smartphone },
  { href: "/retention", label: "Retention", icon: Repeat },
  { href: "/live", label: "Live", icon: Radio },
  { href: "/insights", label: "Insights", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings2 },
];

export function Sidebar({
  organizations,
  projects,
  user,
}: {
  organizations: AnalyticsOrganizationSummary[];
  projects: AnalyticsProjectSummary[];
  user: { email: string; name: string };
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [expanded, setExpanded] = useState(false);
  const { project, organization } = resolveProjectWorkspace({
    organizations,
    projects,
    organizationSlug: searchParams.get("organization") ?? undefined,
    projectSlug: searchParams.get("project") ?? undefined,
  });

  function contextualHref(href: string) {
    const params = new URLSearchParams();
    if (organization) params.set("organization", organization.slug);
    if (project) params.set("project", project.slug);
    const query = params.toString();
    return (query ? `${href}?${query}` : href) as Route;
  }

  return (
    <>
      <aside
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden flex-col overflow-visible border-r border-border bg-[#fbfaf7] shadow-soft transition-[width] duration-300 md:flex",
          expanded ? "w-[268px]" : "w-[84px]",
        )}
      >
        <div
          className={cn(
            "flex h-[70px] shrink-0 items-center border-b border-border transition-all duration-300",
            expanded ? "justify-start gap-3 px-5" : "justify-center",
          )}
        >
          <Link
            href={contextualHref("/overview")}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
            style={{ background: brandColor }}
            aria-label="Logly home"
          >
            <BrandMark size={28} />
          </Link>
          {expanded ? (
            <div className="min-w-0">
              <BrandWordmark className="block truncate text-2xl" />
              <p className="truncate text-[11px] font-medium text-muted-foreground">
                First-party analytics
              </p>
            </div>
          ) : null}
        </div>
        <nav className="scrollbar-hide flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto p-3 pt-5">
          {navigation.map((item) => {
            const active = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={contextualHref(item.href)}
                title={item.label}
                className={cn(
                  "relative flex h-10 items-center rounded-lg text-[#77736c] transition hover:bg-[#efede7] hover:text-foreground",
                  expanded ? "gap-3 px-3" : "w-11 justify-center",
                  active && "bg-[#e8eee9] text-[#286c49]",
                )}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                {expanded ? (
                  <span className="truncate text-sm font-medium">
                    {item.label}
                  </span>
                ) : null}
                {active ? (
                  <span className="absolute -left-3 h-5 w-[3px] rounded-r-full bg-[#347b56]" />
                ) : null}
              </Link>
            );
          })}
        </nav>
        <div className="flex min-h-[72px] items-center border-t border-border p-3">
          <div
            className={cn(
              "flex min-w-0 items-center",
              expanded ? "w-full gap-3" : "justify-center",
            )}
          >
            <SignOutButton label={user.name || user.email} />
            {expanded ? (
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {user.name || "Logly operator"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {user.email}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </aside>
      <nav className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-center justify-around border-t border-border bg-background/95 px-5 backdrop-blur md:hidden">
        {navigation.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={contextualHref(item.href)}
              className={cn(
                "flex flex-col items-center gap-1 text-[10px] text-muted-foreground",
                active && "text-[#286c49]",
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
