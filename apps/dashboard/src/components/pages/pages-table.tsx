import type { AnalyticsPageRow } from "@logly/utils";
import {
  PercentChange,
  percentChange,
} from "@/components/overview/percent-change";

export function RouteLabel({ route }: { route: string | null }) {
  return route === null ? (
    <span className="italic text-muted-foreground">(no route)</span>
  ) : (
    <span className="font-mono" title={route}>
      {route}
    </span>
  );
}

function Change({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) {
    return current > 0 ? (
      <span className="text-[11px] font-medium text-muted-foreground">New</span>
    ) : null;
  }
  return <PercentChange value={percentChange(current, previous)} />;
}

export function PagesTable({
  pages,
  noun,
  previousLabel,
}: {
  pages: AnalyticsPageRow[];
  noun: "page" | "screen";
  previousLabel: string;
}) {
  const max = pages[0]?.views ?? 0;
  return (
    <section className="overflow-hidden rounded-xl border bg-white shadow-soft">
      <div className="flex items-center justify-between gap-3 px-[18px] pb-3 pt-4">
        <h3 className="text-[13px] font-semibold">Top {noun}s</h3>
        <span className="text-[11px] text-muted-foreground">
          Change vs {previousLabel}
        </span>
      </div>
      {pages.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-xs">
            <thead>
              <tr className="border-y bg-[#fbfaf7] text-left text-[11px] text-muted-foreground">
                <th scope="col" className="px-[18px] py-2 font-medium">
                  Route
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Views
                </th>
                <th scope="col" className="w-[72px] px-3 py-2 font-medium">
                  <span className="sr-only">Views change</span>
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Visitors
                </th>
                <th
                  scope="col"
                  className="w-[84px] py-2 pl-3 pr-[18px] font-medium"
                >
                  <span className="sr-only">Visitors change</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {pages.map((page) => (
                <tr
                  key={page.route ?? "(no route)"}
                  className="border-b border-[#f0ede7] last:border-b-0"
                >
                  <td className="max-w-0 px-[18px] py-2.5">
                    <div className="truncate">
                      <RouteLabel route={page.route} />
                    </div>
                    <div
                      className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-[#f0ede7]"
                      aria-hidden
                    >
                      <div
                        className="h-full rounded-full bg-[#9cc2aa]"
                        style={{
                          width: `${max ? (page.views / max) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right font-medium tabular-nums">
                    {page.views.toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5">
                    <Change
                      current={page.views}
                      previous={page.previousViews}
                    />
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {page.visitors.toLocaleString()}
                  </td>
                  <td className="py-2.5 pl-3 pr-[18px]">
                    <Change
                      current={page.visitors}
                      previous={page.previousVisitors}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-[18px] pb-5 text-xs text-muted-foreground">
          No {noun} views in this window.{" "}
          {noun === "page" ? "Pageviews" : "Screen views"} are recorded when the
          SDK&apos;s {noun === "page" ? "pageview tracking" : "trackScreenView"}{" "}
          is enabled.
        </p>
      )}
    </section>
  );
}
