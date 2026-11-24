"use client";

import { Badge } from "@logly/ui/badge";
import { Button } from "@logly/ui/button";
import { cn } from "@logly/ui/cn";
import { Input } from "@logly/ui/input";
import type {
  AnalyticsEventCatalog,
  EventCatalogEntry,
  EventCatalogSimilarReason,
} from "@logly/utils";
import { Pencil, Search } from "lucide-react";
import { useMemo, useState } from "react";
import {
  PercentChange,
  percentChange,
} from "@/components/overview/percent-change";
import { CatalogEditSheet } from "./catalog-edit-sheet";
import { CatalogSparkline } from "./catalog-sparkline";

type Filter = "all" | "active" | "stale" | "hints" | "deprecated" | "hidden";

const filters: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "stale", label: "Stale" },
  { value: "hints", label: "Naming hints" },
  { value: "deprecated", label: "Deprecated" },
  { value: "hidden", label: "Hidden" },
];

const reasons: Record<EventCatalogSimilarReason, string> = {
  separators: "same letters",
  word_order: "same words",
  suffix: "differs by a suffix",
  typo: "one letter apart",
};

function matches(event: EventCatalogEntry, filter: Filter) {
  switch (filter) {
    case "active":
      return event.status === "active";
    case "stale":
      return event.status === "stale";
    case "hints":
      return event.similar.length > 0;
    case "deprecated":
      return event.deprecated;
    case "hidden":
      return event.hidden;
    default:
      return true;
  }
}

const dateFormat = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function ago(value: string | null, now: number) {
  if (!value) return "Never";
  const minutes = Math.max(0, (now - Date.parse(value)) / 60_000);
  if (minutes < 60) return `${Math.floor(minutes)}m ago`;
  if (minutes < 1_440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1_440)}d ago`;
}

function Change({ current, previous }: { current: number; previous: number }) {
  if (previous === 0)
    return current > 0 ? (
      <span className="text-[11px] font-medium text-muted-foreground">New</span>
    ) : null;
  return <PercentChange value={percentChange(current, previous)} />;
}

export function EventStatusBadges({ event }: { event: EventCatalogEntry }) {
  return (
    <>
      {event.deprecated ? <Badge variant="warning">Deprecated</Badge> : null}
      {event.hidden ? <Badge variant="muted">Hidden</Badge> : null}
      {event.status === "stale" ? <Badge variant="outline">Stale</Badge> : null}
    </>
  );
}

/** The catalog list: search, status filters, and admin metadata editing. */
export function CatalogTable({
  catalog,
  project,
  canEdit,
  previousLabel,
}: {
  catalog: AnalyticsEventCatalog;
  project: string;
  canEdit: boolean;
  previousLabel: string;
}) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<EventCatalogEntry | null>(null);
  const now = Date.parse(catalog.end);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return catalog.events.filter(
      (event) =>
        matches(event, filter) &&
        (!needle ||
          event.name.includes(needle) ||
          event.description.toLowerCase().includes(needle) ||
          event.notes.toLowerCase().includes(needle)),
    );
  }, [catalog.events, filter, q]);
  const counts = useMemo(
    () =>
      Object.fromEntries(
        filters.map((option) => [
          option.value,
          catalog.events.filter((event) => matches(event, option.value)).length,
        ]),
      ) as Record<Filter, number>,
    [catalog.events],
  );

  return (
    <section className="overflow-hidden rounded-xl border bg-white shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3 px-[18px] pb-3 pt-4">
        <div
          role="tablist"
          aria-label="Filter events"
          className="flex flex-wrap items-center gap-1"
        >
          {filters.map((option) => (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={filter === option.value}
              onClick={() => setFilter(option.value)}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium",
                filter === option.value
                  ? "border bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {option.label}
              <span className="tabular-nums text-muted-foreground">
                {counts[option.value]}
              </span>
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-[220px]">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Search names and notes"
            aria-label="Search events"
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>
      {catalog.truncated ? (
        <p className="border-t bg-amber-50 px-[18px] py-2 text-[11px] text-amber-800">
          This project has more than 500 event names; the first 500 by name are
          listed.
        </p>
      ) : null}
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-xs">
            <thead>
              <tr className="border-y bg-[#fbfaf7] text-left text-[11px] text-muted-foreground">
                <th scope="col" className="px-[18px] py-2 font-medium">
                  Event
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Volume
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  <span className="sr-only">Trend and change vs </span>
                  vs {previousLabel}
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Sources
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Property keys
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  First seen
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Last seen
                </th>
                {canEdit ? (
                  <th scope="col" className="w-[52px] py-2 pr-[18px]">
                    <span className="sr-only">Edit</span>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((event) => (
                <tr
                  key={event.name}
                  className={cn(
                    "border-b border-[#f0ede7] align-top last:border-b-0",
                    (event.deprecated || event.hidden) && "bg-[#fdfcf9]",
                  )}
                >
                  <td className="max-w-[320px] px-[18px] py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={cn(
                          "font-mono font-medium",
                          event.deprecated && "text-muted-foreground",
                        )}
                      >
                        {event.name}
                      </span>
                      <EventStatusBadges event={event} />
                    </div>
                    {event.description ? (
                      <p className="mt-1 text-muted-foreground">
                        {event.description}
                      </p>
                    ) : null}
                    {event.notes ? (
                      <p className="mt-0.5 whitespace-pre-line text-[11px] text-muted-foreground/80">
                        {event.notes}
                      </p>
                    ) : null}
                    {event.similar.length ? (
                      <p className="mt-1 text-[11px] text-amber-700">
                        Looks like{" "}
                        {event.similar.map((similar, index) => (
                          <span key={similar.name}>
                            {index ? ", " : ""}
                            <span className="font-mono">{similar.name}</span> (
                            {reasons[similar.reason]})
                          </span>
                        ))}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 text-right font-medium tabular-nums">
                    {event.count.toLocaleString()}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <CatalogSparkline
                        values={event.trend}
                        label={`${event.name} trend`}
                      />
                      <Change
                        current={event.count}
                        previous={event.previousCount}
                      />
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      {event.sources.map((source) => (
                        <Badge key={source} variant="outline">
                          {source}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="max-w-[200px] px-3 py-3">
                    {event.properties.length ? (
                      <p
                        className="font-mono text-[11px] text-muted-foreground"
                        title={event.properties.join(", ")}
                      >
                        {event.properties.slice(0, 5).join(", ")}
                        {event.properties.length > 5
                          ? ` +${event.properties.length - 5}`
                          : ""}
                      </p>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">
                        None
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">
                    {event.firstSeen
                      ? dateFormat.format(new Date(event.firstSeen))
                      : "Never"}
                  </td>
                  <td
                    className={cn(
                      "whitespace-nowrap px-3 py-3",
                      event.status === "stale"
                        ? "text-amber-700"
                        : "text-muted-foreground",
                    )}
                    title={event.lastSeen ?? undefined}
                  >
                    {ago(event.lastSeen, now)}
                  </td>
                  {canEdit ? (
                    <td className="py-2 pr-[18px]">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        aria-label={`Edit ${event.name}`}
                        onClick={() => setEditing(event)}
                      >
                        <Pencil className="size-3.5" aria-hidden />
                      </Button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="border-t px-[18px] py-5 text-xs text-muted-foreground">
          {catalog.events.length
            ? "No events match this filter."
            : "No events recorded for this project yet."}
        </p>
      )}
      {!canEdit ? (
        <p className="border-t px-[18px] py-2.5 text-[11px] text-muted-foreground">
          Admins can add descriptions and owners, and deprecate or hide names.
        </p>
      ) : null}
      <CatalogEditSheet
        project={project}
        event={editing}
        onClose={() => setEditing(null)}
      />
    </section>
  );
}
