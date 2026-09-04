import { redirect } from "next/navigation";
import { getDashboardData } from "@/lib/dashboard-data";
import {
  projectWorkspaceHref,
  resolveProjectWorkspace,
} from "@/lib/project-workspace";

type SearchParams = Record<string, string | string[] | undefined>;

export async function loadProjectWorkspace(input: {
  pathname: string;
  searchParams: SearchParams;
  allowEmpty?: boolean;
}) {
  const shell = await getDashboardData();
  const requestedOrganization =
    typeof input.searchParams.organization === "string"
      ? input.searchParams.organization
      : undefined;
  const requestedProject =
    typeof input.searchParams.project === "string"
      ? input.searchParams.project
      : undefined;
  const workspace = resolveProjectWorkspace({
    organizations: shell.organizations,
    projects: shell.projects,
    organizationSlug: requestedOrganization,
    projectSlug: requestedProject,
  });

  if (!workspace.project) {
    if (!input.allowEmpty) {
      redirect(
        projectWorkspaceHref("/settings", workspace, {
          ...input.searchParams,
          projectType: "create",
        }),
      );
    }
    return { data: shell, ...workspace };
  }

  if (
    requestedProject !== workspace.project.slug ||
    requestedOrganization !== workspace.organization?.slug
  ) {
    redirect(
      projectWorkspaceHref(input.pathname, workspace, input.searchParams),
    );
  }

  const data = await getDashboardData({
    organization: workspace.organization?.slug,
    project: workspace.project.slug,
  });
  return { data, ...workspace };
}
