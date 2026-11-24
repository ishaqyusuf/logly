import type { AnalyticsPageEdgeRow } from "@logly/utils";
import { RouteLabel } from "@/components/pages/pages-table";

/** Entry or exit routes with their share of visitor-days. */
export function PagesEdgeList({
  title,
  description,
  rows,
  total,
}: {
  title: string;
  description: string;
  rows: AnalyticsPageEdgeRow[];
  total: number;
}) {
  return (
    <section className="rounded-xl border bg-white shadow-soft">
      <div className="px-[18px] pb-3 pt-4">
        <h3 className="text-[13px] font-semibold">{title}</h3>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {description}
        </p>
      </div>
      {rows.length ? (
        <ol className="px-[18px] pb-3">
          {rows.map((row) => (
            <li
              key={row.route ?? "(no route)"}
              className="grid grid-cols-[minmax(0,1fr)_auto_44px] items-center gap-3 border-t border-[#f0ede7] py-2 text-xs first:border-t-0"
            >
              <span className="truncate">
                <RouteLabel route={row.route} />
              </span>
              <span className="text-right font-medium tabular-nums">
                {row.count.toLocaleString()}
              </span>
              <span className="text-right text-[11px] tabular-nums text-muted-foreground">
                {total ? Math.round((row.count / total) * 100) : 0}%
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="px-[18px] pb-5 text-xs text-muted-foreground">
          No visitor views in this window.
        </p>
      )}
    </section>
  );
}
