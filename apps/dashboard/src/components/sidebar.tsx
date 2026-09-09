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
  Building2,
  ChevronDown,
  LayoutDashboard,
  Plus,
  Radio,
  Settings2,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useMemo, useState } from "react";
import { SignOutButton } from "@/components/sign-out-button";
import { resolveProjectWorkspace } from "@/lib/project-workspace";

const navigation = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/events", label: "Events", icon: Activity },
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
  const [selectorOpen, setSelectorOpen] = useState(false);
  const { project: selectedProject, organization: selectedOrganization } =
    resolveProjectWorkspace({
      organizations,
      projects,
      organizationSlug: searchParams.get("organization") ?? undefined,
      projectSlug: searchParams.get("project") ?? undefined,
    });

  function contextualHref(href: string) {
    const params = new URLSearchParams();
    if (selectedOrganization) {
      params.set("organization", selectedOrganization.slug);
    }
    if (selectedProject) {
      params.set("project", selectedProject.slug);
    }
    const query = params.toString();
    return (query ? `${href}?${query}` : href) as Route;
  }

  return (
    <>
      <aside
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => !selectorOpen && setExpanded(false)}
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

        <div className="relative border-b border-border p-3">
          <button
            type="button"
            aria-expanded={selectorOpen}
            aria-label="Select organization and project"
            onClick={() => {
              setExpanded(true);
              setSelectorOpen((open) => !open);
            }}
            className={cn(
              "flex h-11 items-center rounded-lg text-left transition hover:bg-[#efede7]",
              expanded ? "w-full gap-3 px-3" : "w-11 justify-center",
              selectorOpen && "bg-[#efede7]",
            )}
          >
            <Building2 className="h-[18px] w-[18px] shrink-0 text-[#347b56]" />
            {expanded ? (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {selectedProject?.name ?? "Choose a project"}
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {selectedOrganization?.name ?? "No organization"}
                  </span>
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </>
            ) : null}
          </button>

          {selectorOpen && expanded ? (
            <OrganizationProjectMenu
              organizations={organizations}
              pathname={pathname as Route}
              projects={projects}
              selectedOrganization={selectedOrganization}
              selectedProject={selectedProject}
              onClose={() => setSelectorOpen(false)}
            />
          ) : null}
        </div>

        <nav className="scrollbar-hide flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto p-3">
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

function OrganizationProjectMenu({
  organizations,
  pathname,
  projects,
  selectedOrganization,
  selectedProject,
  onClose,
}: {
  organizations: AnalyticsOrganizationSummary[];
  pathname: Route;
  projects: AnalyticsProjectSummary[];
  selectedOrganization: AnalyticsOrganizationSummary | null;
  selectedProject: AnalyticsProjectSummary | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const organizationProjects = useMemo(
    () =>
      projects.filter(
        (project) => project.organizationId === selectedOrganization?.id,
      ),
    [projects, selectedOrganization?.id],
  );

  function selectionHref(organizationSlug: string, projectSlug: string) {
    const params = new URLSearchParams({ organization: organizationSlug });
    params.set("project", projectSlug);
    return `${pathname}?${params}` as Route;
  }

  function organizationHref(organization: AnalyticsOrganizationSummary) {
    const firstProject = projects.find(
      (project) => project.organizationId === organization.id,
    );
    if (firstProject) {
      return selectionHref(organization.slug, firstProject.slug);
    }
    return `/settings?organization=${organization.slug}&projectType=create` as Route;
  }

  async function createOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/organizations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const result = (await response.json()) as {
        error?: string;
        slug?: string;
      };
      if (!response.ok || !result.slug) {
        throw new Error(result.error ?? "Organization creation failed");
      }
      router.push(
        `/settings?organization=${result.slug}&projectType=create` as Route,
      );
      router.refresh();
      onClose();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Organization creation failed",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="absolute left-3 top-[62px] z-50 w-[min(17rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-[#fbfaf7] shadow-[0_16px_42px_rgba(15,23,42,0.16)]">
      <div className="border-b border-border p-2">
        <p className="px-2 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Organizations
        </p>
        {organizations.map((organization) => (
          <Link
            key={organization.id}
            href={organizationHref(organization)}
            onClick={onClose}
            className={cn(
              "flex items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-[#efede7]",
              organization.id === selectedOrganization?.id && "bg-[#e8eee9]",
            )}
          >
            <span className="grid h-7 w-7 place-items-center rounded-lg border border-border bg-white text-xs font-semibold text-[#347b56]">
              {organization.name.slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1 truncate font-medium">
              {organization.name}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {organization.projectCount}
            </span>
          </Link>
        ))}
        {creating ? (
          <form
            className="mt-2 space-y-2 px-2 pb-1"
            onSubmit={createOrganization}
          >
            <input
              aria-label="Organization name"
              className="h-9 w-full rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-foreground/40"
              onChange={(event) => setName(event.target.value)}
              placeholder="Organization name"
              required
              value={name}
            />
            {error ? <p className="text-xs text-red-700">{error}</p> : null}
            <div className="flex gap-2">
              <button
                className="h-8 flex-1 rounded-md bg-[#17201b] px-3 text-xs font-medium text-white disabled:opacity-50"
                disabled={submitting}
                type="submit"
              >
                {submitting ? "Creating…" : "Create"}
              </button>
              <button
                className="h-8 rounded-md border border-border px-3 text-xs"
                onClick={() => setCreating(false)}
                type="button"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="mt-1 flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm text-muted-foreground hover:bg-[#efede7] hover:text-foreground"
          >
            <span className="grid h-7 w-7 place-items-center rounded-lg border border-dashed border-border bg-white">
              <Plus className="h-3.5 w-3.5" />
            </span>
            New organization
          </button>
        )}
      </div>

      <div className="p-2">
        <p className="px-2 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {selectedOrganization?.name ?? "Organization"} projects
        </p>
        {organizationProjects.map((project) => (
          <Link
            key={project.id}
            href={selectionHref(project.organizationSlug, project.slug)}
            onClick={onClose}
            className={cn(
              "flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-[#efede7]",
              project.id === selectedProject?.id && "bg-[#e8eee9] font-medium",
            )}
          >
            <span className="truncate">{project.name}</span>
            <span className="ml-3 h-2 w-2 shrink-0 rounded-full bg-[#4f8c68]" />
          </Link>
        ))}
        <Link
          href={
            (selectedOrganization
              ? `/settings?organization=${selectedOrganization.slug}&projectType=create`
              : "/settings?projectType=create") as Route
          }
          onClick={onClose}
          className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-[#efede7] hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" /> Connect project
        </Link>
      </div>
    </div>
  );
}
