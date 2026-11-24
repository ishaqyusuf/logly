import { cn } from "@logly/ui/cn";
import {
  EVENT_CATALOG_STALE_DAYS,
  type EventCatalogRange,
  type EventCatalogStaleDays,
} from "@logly/utils";
import type { Route } from "next";
import Link from "next/link";

const ranges: EventCatalogRange[] = ["24h", "7d", "30d"];

function Segment({
  label,
  caption,
  children,
}: {
  label: string;
  caption: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-muted-foreground">{caption}</span>
      <nav
        aria-label={label}
        className="flex items-center rounded-lg border bg-white p-1"
      >
        {children}
      </nav>
    </div>
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
      scroll={false}
      className={cn(
        "inline-flex h-7 items-center rounded-md px-2.5 text-xs font-medium",
        active
          ? "border bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
      )}
    >
      {children}
    </Link>
  );
}

/** URL-backed volume range and stale threshold. */
export function CatalogFilters({
  query,
  range,
  staleDays,
}: {
  query: string;
  range: EventCatalogRange;
  staleDays: EventCatalogStaleDays;
}) {
  const href = (next: { range?: string; stale?: number }) => {
    const params = new URLSearchParams(query);
    params.set("range", next.range ?? range);
    params.set("stale", String(next.stale ?? staleDays));
    return `/catalog?${params}`;
  };
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Segment label="Volume range" caption="Volume">
        {ranges.map((option) => (
          <SegmentLink
            key={option}
            href={href({ range: option })}
            active={range === option}
          >
            {option}
          </SegmentLink>
        ))}
      </Segment>
      <Segment label="Stale after" caption="Stale after">
        {EVENT_CATALOG_STALE_DAYS.map((option) => (
          <SegmentLink
            key={option}
            href={href({ stale: option })}
            active={staleDays === option}
          >
            {option}d
          </SegmentLink>
        ))}
      </Segment>
    </div>
  );
}
