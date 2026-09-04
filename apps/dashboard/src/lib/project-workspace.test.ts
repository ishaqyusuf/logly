import { describe, expect, test } from "bun:test";
import type {
  AnalyticsOrganizationSummary,
  AnalyticsProjectSummary,
} from "@logly/utils";
import {
  projectWorkspaceHref,
  resolveProjectWorkspace,
} from "./project-workspace";

const organizations: AnalyticsOrganizationSummary[] = [
  { id: "org-1", slug: "personal", name: "Personal", projectCount: 2 },
  { id: "org-2", slug: "empty", name: "Empty", projectCount: 0 },
];
const projects: AnalyticsProjectSummary[] = [
  {
    id: "project-1",
    organizationId: "org-1",
    organizationSlug: "personal",
    slug: "afterservice",
    name: "Afterservice",
    origin: "afterservice.app",
    status: "healthy",
    eventsToday: 4,
    visitorsToday: 2,
    lastEventAt: null,
  },
  {
    id: "project-2",
    organizationId: "org-1",
    organizationSlug: "personal",
    slug: "logly",
    name: "Logly",
    origin: "logly.app",
    status: "healthy",
    eventsToday: 8,
    visitorsToday: 3,
    lastEventAt: null,
  },
];

describe("resolveProjectWorkspace", () => {
  test("uses the requested project as the workspace and corrects its organization", () => {
    const result = resolveProjectWorkspace({
      organizations,
      projects,
      organizationSlug: "empty",
      projectSlug: "logly",
    });
    expect(result.project?.slug).toBe("logly");
    expect(result.organization?.slug).toBe("personal");
  });

  test("selects the first project when the URL has no project", () => {
    const result = resolveProjectWorkspace({ organizations, projects });
    expect(result.project?.slug).toBe("afterservice");
  });

  test("preserves an empty organization so project creation can open", () => {
    const result = resolveProjectWorkspace({
      organizations,
      projects,
      organizationSlug: "empty",
    });
    expect(result.organization?.slug).toBe("empty");
    expect(result.project).toBeNull();
  });
});

test("projectWorkspaceHref preserves filters and writes canonical scope", () => {
  const workspace = resolveProjectWorkspace({ organizations, projects });
  expect(
    projectWorkspaceHref("/events", workspace, {
      q: "created",
      sources: ["server", "browser"],
    }),
  ).toBe(
    "/events?q=created&sources=server%2Cbrowser&organization=personal&project=afterservice",
  );
});
