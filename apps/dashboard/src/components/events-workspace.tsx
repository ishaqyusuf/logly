"use client";

import type {
  AnalyticsEventFilterOptions,
  AnalyticsEventPage,
  AnalyticsEventSummary,
} from "@logly/utils";
import { EventAnalytics } from "./event-analytics";
import { DataTable } from "./tables/events/data-table";

export function EventsWorkspace({
  initialPage,
  options,
  scope,
  initialSummary,
  projectName,
}: {
  initialPage: AnalyticsEventPage;
  options: AnalyticsEventFilterOptions;
  scope: { organization?: string; project: string };
  initialSummary: AnalyticsEventSummary;
  projectName: string;
}) {
  return (
    <div className="space-y-6">
      <EventAnalytics
        initialSummary={initialSummary}
        scope={scope}
        projectName={projectName}
      />
      <DataTable initialPage={initialPage} options={options} scope={scope} />
    </div>
  );
}
