import type {
  AnalyticsOrganizationSummary,
  AnalyticsProjectSummary,
} from "@logly/utils";
import type { Route } from "next";

export type ProjectWorkspace = {
  organization: AnalyticsOrganizationSummary | null;
  project: AnalyticsProjectSummary | null;
};

export function resolveProjectWorkspace(input: {
  organizations: AnalyticsOrganizationSummary[];
  projects: AnalyticsProjectSummary[];
  organizationSlug?: string;
  projectSlug?: string;
}): ProjectWorkspace {
  const requestedProject = input.projects.find(
    (project) => project.slug === input.projectSlug,
  );
  if (requestedProject) {
    return {
      project: requestedProject,
      organization:
        input.organizations.find(
          (organization) => organization.id === requestedProject.organizationId,
        ) ?? null,
    };
  }

  const requestedOrganization = input.organizations.find(
    (organization) => organization.slug === input.organizationSlug,
  );
  if (requestedOrganization) {
    return {
      organization: requestedOrganization,
      project:
        input.projects.find(
          (project) => project.organizationId === requestedOrganization.id,
        ) ?? null,
    };
  }

  const project = input.projects[0] ?? null;
  return {
    project,
    organization: project
      ? (input.organizations.find(
          (organization) => organization.id === project.organizationId,
        ) ?? null)
      : (input.organizations[0] ?? null),
  };
}

export function projectWorkspaceHref(
  pathname: string,
  workspace: ProjectWorkspace,
  current: Record<string, string | string[] | undefined> = {},
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(current)) {
    if (typeof value === "string") params.set(key, value);
    if (Array.isArray(value) && value.length) params.set(key, value.join(","));
  }
  if (workspace.organization) {
    params.set("organization", workspace.organization.slug);
  } else {
    params.delete("organization");
  }
  if (workspace.project) {
    params.set("project", workspace.project.slug);
  } else {
    params.delete("project");
  }
  const query = params.toString();
  return (query ? `${pathname}?${query}` : pathname) as Route;
}
