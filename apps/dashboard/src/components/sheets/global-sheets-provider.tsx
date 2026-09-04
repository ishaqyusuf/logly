"use client";

import type {
  AnalyticsOrganizationSummary,
  AnalyticsProjectSummary,
} from "@logly/utils";
import dynamic from "next/dynamic";

const GlobalSheets = dynamic(
  () => import("./global-sheets").then((module) => module.GlobalSheets),
  { ssr: false },
);

export function GlobalSheetsProvider(props: {
  organizations: AnalyticsOrganizationSummary[];
  projects: AnalyticsProjectSummary[];
  mode: "demo" | "database";
}) {
  return <GlobalSheets {...props} />;
}
