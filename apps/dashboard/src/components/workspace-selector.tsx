"use client";

import { cn } from "@logly/ui/cn";
import type {
  AnalyticsOrganizationSummary,
  AnalyticsProjectSummary,
} from "@logly/utils";
import {
  Building2,
  Check,
  ChevronDown,
  FolderKanban,
  Plus,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { resolveProjectWorkspace } from "@/lib/project-workspace";

export function WorkspaceSelector({
  organizations,
  projects,
}: {
  organizations: AnalyticsOrganizationSummary[];
  projects: AnalyticsProjectSummary[];
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [activeOrganizationId, setActiveOrganizationId] = useState<
    string | null
  >(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { project: selectedProject, organization: selectedOrganization } =
    resolveProjectWorkspace({
      organizations,
      projects,
      organizationSlug: searchParams.get("organization") ?? undefined,
      projectSlug: searchParams.get("project") ?? undefined,
    });
  const activeOrganization =
    organizations.find((item) => item.id === activeOrganizationId) ??
    selectedOrganization;
  const organizationProjects = projects.filter(
    (item) => item.organizationId === activeOrganization?.id,
  );

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function selectionHref(item: AnalyticsProjectSummary) {
    const params = new URLSearchParams({
      organization: item.organizationSlug,
      project: item.slug,
    });
    return `${pathname}?${params}` as Route;
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
      if (!response.ok || !result.slug)
        throw new Error(result.error ?? "Organization creation failed");
      setOpen(false);
      setCreating(false);
      setName("");
      router.push(
        `/settings?organization=${result.slug}&projectType=create` as Route,
      );
      router.refresh();
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
    <div ref={rootRef} className="relative min-w-0">
      <button
        ref={triggerRef}
        type="button"
        aria-label="Select team and project"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="workspace-selector-menu"
        onClick={() => {
          setActiveOrganizationId(selectedOrganization?.id ?? null);
          setOpen((value) => !value);
        }}
        className={cn(
          "flex h-10 max-w-[min(64vw,360px)] items-center gap-2 rounded-md px-2 text-left text-sm font-medium transition-colors hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#347b56]",
          open && "bg-muted",
        )}
      >
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-border bg-white text-[#347b56]">
          <Building2 className="h-3.5 w-3.5" />
        </span>
        <span className="truncate text-muted-foreground">
          {selectedOrganization?.name ?? "Choose team"}
        </span>
        <span className="text-muted-foreground">/</span>
        <span className="truncate font-semibold text-foreground">
          {selectedProject?.name ?? "Choose project"}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </button>
      {open ? (
        <div
          id="workspace-selector-menu"
          role="dialog"
          className="absolute left-0 top-[calc(100%+8px)] z-50 grid w-[26rem] max-w-[calc(100vw-3.5rem)] grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] overflow-hidden rounded-xl border border-border bg-[#fbfaf7] shadow-[0_16px_42px_rgba(15,23,42,0.16)]"
          aria-label="Team and project selector"
        >
          <div className="min-w-0 border-r border-border p-2">
            <p className="px-2 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Teams
            </p>
            <div className="max-h-64 overflow-y-auto">
              {organizations.map((organization) => (
                <button
                  key={organization.id}
                  type="button"
                  aria-pressed={organization.id === activeOrganization?.id}
                  onClick={() => setActiveOrganizationId(organization.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs hover:bg-[#efede7]",
                    organization.id === activeOrganization?.id &&
                      "bg-[#e8eee9] text-[#286c49]",
                  )}
                >
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-border bg-white font-semibold">
                    {organization.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {organization.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {organization.projectCount}
                  </span>
                </button>
              ))}
            </div>
            {creating ? (
              <form
                className="mt-2 space-y-2 border-t border-border px-2 pt-3"
                onSubmit={createOrganization}
              >
                <input
                  aria-label="Team name"
                  className="h-9 w-full rounded-md border border-border bg-white px-2 text-xs outline-none focus:border-[#347b56]"
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Team name"
                  required
                  value={name}
                />
                {error ? (
                  <p role="alert" className="text-xs text-red-700">
                    {error}
                  </p>
                ) : null}
                <div className="flex gap-1">
                  <button
                    className="h-8 flex-1 rounded-md bg-[#17201b] px-2 text-xs font-medium text-white disabled:opacity-50"
                    disabled={submitting}
                    type="submit"
                  >
                    {submitting ? "Creating…" : "Create"}
                  </button>
                  <button
                    className="h-8 rounded-md border border-border px-2 text-xs"
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
                className="mt-2 flex w-full items-center gap-2 border-t border-border px-2 pt-3 pb-1 text-left text-xs text-muted-foreground hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" /> New team
              </button>
            )}
          </div>
          <div className="min-w-0 p-2">
            <p className="truncate px-2 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {activeOrganization?.name ?? "Team"} projects
            </p>
            <div className="max-h-64 overflow-y-auto">
              {organizationProjects.map((item) => (
                <Link
                  key={item.id}
                  href={selectionHref(item)}
                  aria-current={
                    item.id === selectedProject?.id ? "page" : undefined
                  }
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-2 py-2 text-xs hover:bg-[#efede7]",
                    item.id === selectedProject?.id &&
                      "bg-[#e8eee9] font-semibold text-[#286c49]",
                  )}
                >
                  <FolderKanban className="h-3.5 w-3.5 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{item.name}</span>
                  {item.id === selectedProject?.id ? (
                    <Check className="h-3.5 w-3.5 shrink-0" />
                  ) : null}
                </Link>
              ))}
              {organizationProjects.length === 0 ? (
                <p className="px-2 py-3 text-xs text-muted-foreground">
                  No projects yet
                </p>
              ) : null}
            </div>
            <Link
              href={
                (activeOrganization
                  ? `/settings?organization=${activeOrganization.slug}&projectType=create`
                  : "/settings?projectType=create") as Route
              }
              onClick={() => setOpen(false)}
              className="mt-2 flex items-center gap-2 border-t border-border px-2 pt-3 pb-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" /> Connect project
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
