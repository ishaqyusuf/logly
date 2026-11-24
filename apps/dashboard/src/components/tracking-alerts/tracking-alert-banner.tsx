import { isTrackingAlertOpen, type TrackingAlertState } from "@logly/utils";
import { formatDistanceToNowStrict } from "date-fns";
import { AlertTriangle, ArrowRight } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import {
  describeTrackingAlert,
  severityLabels,
} from "@/components/tracking-alerts/tracking-alert-copy";

/** Overview banner for an open tracking-quiet alert; renders nothing otherwise. */
export function TrackingAlertBanner({
  state,
  historyHref,
}: {
  state?: TrackingAlertState;
  historyHref: Route;
}) {
  if (!state || !isTrackingAlertOpen(state.status)) return null;
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
    >
      <AlertTriangle className="size-4 shrink-0 text-red-600" aria-hidden />
      <p className="min-w-0 flex-1">
        <span className="font-semibold">
          {severityLabels[state.status]}
          {state.openedAt
            ? ` ${formatDistanceToNowStrict(new Date(state.openedAt), { addSuffix: true })}`
            : ""}
          .
        </span>{" "}
        {describeTrackingAlert(state)} Check the SDK setup or recent deploys.
      </p>
      <Link
        href={historyHref}
        className="flex items-center gap-1 text-xs font-medium text-red-800 underline-offset-2 hover:underline"
      >
        Alert history <ArrowRight className="size-3.5" />
      </Link>
    </div>
  );
}
