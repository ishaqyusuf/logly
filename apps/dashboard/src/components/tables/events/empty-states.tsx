"use client";

import {
  EmptyState as CoreEmptyState,
  NoResults as CoreNoResults,
} from "@/components/tables/core";
import { useEventFilterParams } from "@/hooks/use-event-filter-params";

export function EmptyState() {
  return (
    <CoreEmptyState
      title="Waiting for the first event"
      description="Install an SDK and send an event. Logly will show it here within seconds."
      actionLabel="View projects"
      onAction={() => {
        window.location.href = "/projects";
      }}
    />
  );
}

export function NoResults() {
  const { setFilter } = useEventFilterParams();
  return <CoreNoResults onClear={() => void setFilter(null)} />;
}
