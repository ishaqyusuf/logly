import { cn } from "@logly/ui/cn";
import {
  RETENTION_RANGES,
  type RetentionRange,
  type RetentionSurface,
} from "@logly/utils";
import type { Route } from "next";
import Link from "next/link";
import { RetentionEventSelect } from "./retention-event-select";

const rangeLabels: Record<RetentionRange, string> = {
  "7d": "7 days",
  "30d": "5 weeks",
  "12w": "12 weeks",
};
const surfaces: Array<{ value: RetentionSurface; label: string }> = [
  { value: "all", label: "All" },
  { value: "web", label: "Web" },
  { value: "mobile", label: "Mobile" },
];

function Segment({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <nav
      aria-label={label}
      className="flex items-center rounded-lg border bg-white p-1"
    >
      {children}
    </nav>
  );
}

function SegmentLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href as Route}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-7 items-center whitespace-nowrap rounded-md px-2.5 text-xs font-medium",
        active
          ? "border bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
      )}
    >
      {children}
    </Link>
  );
}

/**
 * URL-backed controls: cohort range, web/mobile (only when the project sends
 * both entry events) and the returning event.
 */
export function RetentionFilters({
  query,
  range,
  surface,
  returnEvent,
  showSurfaces,
  eventNames,
  deprecatedEvents,
}: {
  query: string;
  range: RetentionRange;
  surface: RetentionSurface;
  returnEvent: string | null;
  showSurfaces: boolean;
  eventNames: string[];
  deprecatedEvents?: string[];
}) {
  const params = new URLSearchParams(query);
  params.set("range", range);
  if (surface !== "all") params.set("surface", surface);
  if (returnEvent) params.set("event", returnEvent);
  const href = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    return `/retention?${next}`;
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <RetentionEventSelect
        query={params.toString()}
        value={returnEvent}
        names={eventNames}
        deprecated={deprecatedEvents}
      />
      {showSurfaces ? (
        <Segment label="Web or mobile">
          {surfaces.map((option) => (
            <SegmentLink
              key={option.value}
              href={href(
                "surface",
                option.value === "all" ? null : option.value,
              )}
              active={surface === option.value}
            >
              {option.label}
            </SegmentLink>
          ))}
        </Segment>
      ) : null}
      <Segment label="Cohort range">
        {RETENTION_RANGES.map((option) => (
          <SegmentLink
            key={option}
            href={href("range", option)}
            active={range === option}
          >
            {rangeLabels[option]}
          </SegmentLink>
        ))}
      </Segment>
    </div>
  );
}
