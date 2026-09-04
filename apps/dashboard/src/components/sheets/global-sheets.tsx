"use client";

import type {
  AnalyticsOrganizationSummary,
  AnalyticsProjectSummary,
} from "@logly/utils";
import { EventSheet } from "./event-sheet";
import { ProjectSheet } from "./project-sheet";

export function GlobalSheets(props: {
  organizations: AnalyticsOrganizationSummary[];
  projects: AnalyticsProjectSummary[];
  mode: "demo" | "database";
}) {
  return (
    <>
      <EventSheet />
      <ProjectSheet
        organizations={props.organizations}
        projects={props.projects}
        mode={props.mode}
      />
    </>
  );
}
