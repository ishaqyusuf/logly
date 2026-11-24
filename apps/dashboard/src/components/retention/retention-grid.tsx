import { cn } from "@logly/ui/cn";
import {
  type AnalyticsRelease,
  type AnalyticsRetentionReport,
  groupReleasesByCohort,
} from "@logly/utils";
import { RELEASE_MARKER_COLOR } from "@/components/charts/release-markers";
import {
  formatCohort,
  formatRate,
  heatBackground,
  PARTIAL_BACKGROUND,
  periodLabel,
} from "./retention-format";

function releaseTitle(releases: AnalyticsRelease[]) {
  return `Deployed in this cohort: ${releases
    .map((release) => release.version)
    .join(", ")}`;
}

/**
 * Cohort heat grid: one row per first-seen day or week, one column per period
 * since. Periods still running are hatched and starred rather than shown as
 * drops; periods that have not started are blank.
 */
export function RetentionGrid({
  report,
  releases,
}: {
  report: AnalyticsRetentionReport;
  /** Deploy markers (feature 2), flagged on the cohort they were deployed in. */
  releases?: AnalyticsRelease[];
}) {
  const releaseGroups = groupReleasesByCohort(
    releases ?? [],
    report.cohorts.map((cohort) => cohort.start),
    report.granularity,
  );
  const unit = report.granularity === "day" ? "day" : "week";
  const columns = Array.from({ length: report.periods }, (_, index) => index);
  // Newest cohort first, as in most retention tables.
  const cohorts = [...report.cohorts].reverse();

  return (
    <section className="overflow-hidden rounded-xl border bg-white shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3 px-[18px] pb-3 pt-4">
        <div>
          <h3 className="text-[13px] font-semibold">Cohorts</h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Users by the {unit} they were first seen (UTC), and the share who
            came back in each later {unit}
          </p>
        </div>
        <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <li className="flex items-center gap-1.5">
            <span
              className="size-3 rounded-[3px] border border-dashed"
              style={{ background: PARTIAL_BACKGROUND }}
            />
            {unit === "day" ? "Day" : "Week"} still running
          </li>
          {releaseGroups.size ? (
            <li className="flex items-center gap-1.5">
              <span
                className="size-2 rotate-45"
                style={{ background: RELEASE_MARKER_COLOR }}
              />
              Deploy in cohort
            </li>
          ) : null}
        </ul>
      </div>
      <div className="overflow-x-auto border-t">
        <table className="w-full min-w-max border-separate border-spacing-0 text-xs">
          <thead>
            <tr className="text-[11px] text-muted-foreground">
              <th
                scope="col"
                className="sticky left-0 z-10 bg-white px-[18px] py-2 text-left font-medium"
              >
                Cohort
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Users
              </th>
              {columns.map((period) => (
                <th
                  key={period}
                  scope="col"
                  className="min-w-[64px] px-1 py-2 text-center font-medium"
                >
                  {periodLabel(report.granularity, period)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="bg-[#faf9f6] font-medium">
              <th
                scope="row"
                className="sticky left-0 z-10 bg-[#faf9f6] px-[18px] py-2 text-left"
              >
                Average
              </th>
              <td className="px-3 py-2 text-right tabular-nums">
                {report.totals.users.toLocaleString()}
              </td>
              {report.average.map((point) => (
                <td
                  key={point.period}
                  className="px-1 py-2 text-center tabular-nums"
                  title={
                    point.rate === null
                      ? "No cohort has finished this period yet"
                      : `${point.users.toLocaleString()} of ${point.cohortUsers.toLocaleString()} users across ${point.cohorts} complete cohort${point.cohorts === 1 ? "" : "s"}`
                  }
                >
                  {formatRate(point.rate)}
                </td>
              ))}
            </tr>
            {cohorts.map((cohort) => {
              const deployed = releaseGroups.get(cohort.start);
              return (
                <tr key={cohort.start}>
                  <th
                    scope="row"
                    className="sticky left-0 z-10 whitespace-nowrap border-t bg-white px-[18px] py-1.5 text-left font-medium"
                  >
                    <span className="flex items-center gap-1.5">
                      {formatCohort(cohort.start, report.granularity)}
                      {cohort.complete ? null : (
                        <span className="rounded-full border px-1.5 text-[10px] font-normal text-muted-foreground">
                          in progress
                        </span>
                      )}
                      {deployed ? (
                        <span
                          role="img"
                          aria-label={releaseTitle(deployed)}
                          title={releaseTitle(deployed)}
                          className="size-2 rotate-45"
                          style={{ background: RELEASE_MARKER_COLOR }}
                        />
                      ) : null}
                    </span>
                  </th>
                  <td className="border-t px-3 py-1.5 text-right tabular-nums">
                    {cohort.size.toLocaleString()}
                  </td>
                  {cohort.cells.map((cell, period) => {
                    if (!cell)
                      return <td key={period} className="border-t p-0.5" />;
                    const partial = cell.status === "partial";
                    const empty = cohort.size === 0;
                    return (
                      <td key={cell.period} className="border-t p-0.5">
                        <div
                          className={cn(
                            "flex h-10 flex-col items-center justify-center rounded-md tabular-nums",
                            partial && "border border-dashed border-[#cfcac0]",
                            cell.rate > 0.55 && !partial
                              ? "text-white"
                              : "text-foreground",
                          )}
                          style={{
                            background: partial
                              ? PARTIAL_BACKGROUND
                              : empty
                                ? undefined
                                : heatBackground(cell.rate),
                          }}
                          title={
                            empty
                              ? "No new users in this cohort"
                              : `${cell.users.toLocaleString()} of ${cohort.size.toLocaleString()} users${partial ? ` so far; this ${unit} has not ended` : ""}`
                          }
                        >
                          {empty ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <>
                              <span className="text-[12px] font-medium">
                                {formatRate(cell.rate)}
                                {partial ? "*" : ""}
                              </span>
                              <span
                                className={cn(
                                  "text-[10px]",
                                  cell.rate > 0.55 && !partial
                                    ? "text-white/80"
                                    : "text-muted-foreground",
                                )}
                              >
                                {cell.users.toLocaleString()}
                              </span>
                            </>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="border-t px-[18px] py-2.5 text-[11px] text-muted-foreground">
        * The {unit} has not ended, so the share can still grow. The average row
        uses only finished periods, weighted by cohort size.
      </p>
    </section>
  );
}
