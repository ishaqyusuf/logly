import type { AnalyticsEventRow } from "@logly/utils";
import { format } from "date-fns";
import {
  Braces,
  Clock3,
  Fingerprint,
  Globe2,
  MapPin,
  Route,
  Smartphone,
} from "lucide-react";
import Link from "next/link";
import { EventSheetHeader } from "@/components/event-sheet-header";
import { formatCountry } from "@/lib/country-display";

export function EventContent({
  event,
  loading,
  error,
}: {
  event?: AnalyticsEventRow;
  loading: boolean;
  error: Error | null;
}) {
  if (loading)
    return (
      <div className="space-y-4 p-6">
        <div className="h-7 w-48 animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  if (!event || error)
    return (
      <div className="grid h-full place-items-center p-8 text-sm text-muted-foreground">
        This event is unavailable in the selected project.
      </div>
    );
  return (
    <>
      <EventSheetHeader event={event} />
      <div className="space-y-7 p-6">
        <section>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Context
          </p>
          <div className="overflow-hidden rounded-xl border border-border bg-white">
            <Detail
              icon={Clock3}
              label="Occurred"
              value={format(
                new Date(event.occurredAt),
                "MMM d, yyyy · HH:mm:ss",
              )}
            />
            <Detail icon={Globe2} label="Project" value={event.project} />
            <Detail
              icon={Route}
              label="Route"
              value={event.route ?? "Server event"}
            />
            <Detail
              icon={MapPin}
              label="Country"
              value={formatCountry(event.country)}
            />
            {event.platform ? (
              <Detail
                icon={Smartphone}
                label="Platform"
                value={
                  event.appVersion
                    ? `${event.platform} · ${event.appVersion}${event.appBuild ? ` (${event.appBuild})` : ""}`
                    : event.platform
                }
              />
            ) : null}
            <Detail
              icon={Fingerprint}
              label="Visitor"
              value={event.visitorKey ?? "Trusted server event"}
              last
            />
          </div>
        </section>
        <section>
          <p className="mb-3 text-sm font-medium">Groups</p>
          {Object.entries(event.groups ?? {}).length ? (
            Object.entries(event.groups ?? {}).map(([type, group]) => (
              <div key={type} className="mb-3 rounded-xl border p-4 text-sm">
                <p className="font-medium">
                  {String(group.properties?.name ?? group.key)}
                </p>
                <p className="mt-1 break-all text-xs text-muted-foreground">
                  {type} · {group.key}
                </p>
                <pre className="mt-2 overflow-auto text-xs">
                  {JSON.stringify(group.properties ?? {}, null, 2)}
                </pre>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              No group attribution on this event.
            </p>
          )}
          {event.actorId && (
            <Link
              className="block break-all text-xs text-muted-foreground underline"
              href={
                `/events?${new URLSearchParams({ project: event.project, actor: event.actorId })}` as import("next").Route
              }
            >
              View events for this user: {event.actorId.slice(0, 12)}…
            </Link>
          )}
        </section>
        <section>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Properties
            </p>
            <Braces className="size-4 text-muted-foreground" />
          </div>
          <pre className="overflow-x-auto rounded-xl border border-border bg-[#171a18] p-4 text-xs leading-6 text-[#d5e7da]">
            {JSON.stringify(event.properties, null, 2)}
          </pre>
        </section>
        <div className="rounded-xl border border-dashed border-border p-4 text-xs leading-5 text-muted-foreground">
          Raw browser identifiers are never displayed or stored. Visitor keys
          are project-scoped and pseudonymous.
        </div>
      </div>
    </>
  );
}

function Detail({
  icon: Icon,
  label,
  value,
  last = false,
}: {
  icon: typeof Clock3;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <div
      className={`grid grid-cols-[22px_100px_1fr] items-center gap-2 px-4 py-3 text-sm ${last ? "" : "border-b border-border"}`}
    >
      <Icon className="size-4 text-muted-foreground" />
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate text-right font-medium">{value}</span>
    </div>
  );
}
