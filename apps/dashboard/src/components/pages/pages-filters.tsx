import { cn } from "@logly/ui/cn";
import type {
  AnalyticsOverviewRange,
  AnalyticsPageViewEvent,
} from "@logly/utils";
import type { Route } from "next";
import Link from "next/link";

const ranges: AnalyticsOverviewRange[] = ["24h", "7d", "30d"];
const views: Array<{ value: AnalyticsPageViewEvent; label: string }> = [
  { value: "page_view", label: "Web pages" },
  { value: "screen_view", label: "App screens" },
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

/** URL-backed range and view controls; the view toggle appears only when both kinds exist. */
export function PagesFilters({
  query,
  range,
  view,
  requestedView,
  available,
}: {
  query: string;
  range: AnalyticsOverviewRange;
  view: AnalyticsPageViewEvent;
  requestedView?: AnalyticsPageViewEvent;
  available: Record<AnalyticsPageViewEvent, number>;
}) {
  const href = (next: { range?: string; view?: string }) => {
    const params = new URLSearchParams(query);
    params.set("range", next.range ?? range);
    const nextView = next.view ?? requestedView;
    if (nextView) params.set("view", nextView);
    return `/pages?${params}`;
  };
  const showViews =
    (available.page_view > 0 && available.screen_view > 0) ||
    requestedView !== undefined;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {showViews ? (
        <Segment label="Page or screen views">
          {views.map((option) => (
            <SegmentLink
              key={option.value}
              href={href({ view: option.value })}
              active={view === option.value}
            >
              {option.label}
            </SegmentLink>
          ))}
        </Segment>
      ) : null}
      <Segment label="Pages date range">
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
    </div>
  );
}
