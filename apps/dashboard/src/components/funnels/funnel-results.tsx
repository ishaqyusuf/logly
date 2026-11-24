import type { AnalyticsFunnel } from "@logly/utils";
import { breakdownLabels, formatMedian, windowLabels } from "./funnel-format";

function percent(value: number, of: number) {
  return of ? `${Math.round((value / of) * 1000) / 10}%` : "—";
}

export function FunnelResults({ report }: { report: AnalyticsFunnel }) {
  const entrants = report.steps[0]?.visitors ?? 0;
  const last = report.steps.at(-1);
  return (
    <section
      aria-label="Funnel results"
      className="rounded-xl border bg-white p-5 shadow-soft"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Results</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {entrants.toLocaleString()} visitors entered ·{" "}
            {last?.conversion ?? 0}% completed all {report.steps.length} steps
            within {windowLabels[report.window]}
          </p>
        </div>
        {report.capped ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-900">
            Only the first {report.visitorCap.toLocaleString()} visitors to
            enter were followed. Narrow the date range for a complete count.
          </p>
        ) : null}
      </div>
      {entrants === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          No visitor reached step 1 in this date range. Check the event name and
          filters, or widen the range.
        </p>
      ) : (
        <ol className="mt-6 flex flex-col">
          {report.steps.map((step, index) => (
            <li key={`${index}-${step.name}`} className="flex flex-col">
              {index > 0 ? (
                <div className="flex flex-wrap gap-x-4 gap-y-1 py-2 pl-3 text-xs text-muted-foreground">
                  <span className="border-l-2 border-dashed pl-3">
                    <span className="font-medium text-red-700 tabular-nums">
                      −{step.dropOff.toLocaleString()}
                    </span>{" "}
                    dropped off (
                    {percent(
                      step.dropOff,
                      report.steps[index - 1]?.visitors ?? 0,
                    )}
                    )
                  </span>
                  <span>
                    Median time from step {index}:{" "}
                    <span className="font-medium text-foreground tabular-nums">
                      {formatMedian(step.medianSeconds)}
                    </span>
                  </span>
                </div>
              ) : null}
              <div className="flex flex-col gap-2 rounded-lg border bg-[#fbfaf7] p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <span className="min-w-0 [overflow-wrap:anywhere]">
                    <span className="mr-2 inline-flex size-5 items-center justify-center rounded-full bg-foreground text-[11px] font-medium text-background">
                      {index + 1}
                    </span>
                    <span className="font-mono text-xs">{step.name}</span>
                    {step.route ? (
                      <span className="mt-1 block text-xs text-muted-foreground sm:ml-2 sm:mt-0 sm:inline">
                        on <span className="font-mono">{step.route}</span>
                      </span>
                    ) : null}
                    {step.property ? (
                      <span className="mt-1 block text-xs text-muted-foreground sm:ml-2 sm:mt-0 sm:inline">
                        where{" "}
                        <span className="font-mono">
                          {step.property.key} = {step.property.value}
                        </span>
                      </span>
                    ) : null}
                  </span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    <span className="text-sm font-medium text-foreground">
                      {step.visitors.toLocaleString()}
                    </span>{" "}
                    · {step.conversion}% of step 1
                    {index > 0 ? ` · ${step.stepConversion}% of previous` : ""}
                  </span>
                </div>
                <div
                  className="h-3 overflow-hidden rounded-full bg-muted"
                  role="img"
                  aria-label={`${step.conversion}% of step 1`}
                >
                  <div
                    className="h-full rounded-full bg-[#4f8c68]"
                    style={{
                      width: `${step.visitors ? Math.max(1, step.conversion) : 0}%`,
                    }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
      {report.breakdown && report.segments.length ? (
        <div className="mt-6">
          <p className="text-sm font-semibold">
            By {breakdownLabels[report.breakdown].toLowerCase()}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Taken from each visitor's step-1 event.{" "}
            {report.segments.some((s) => s.value === "(other)")
              ? `Top ${report.segments.length - 1} values; the rest are in (other).`
              : "All values."}
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[480px] text-xs">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">
                    {breakdownLabels[report.breakdown]}
                  </th>
                  {report.steps.map((step, index) => (
                    <th
                      key={`${index}-${step.name}`}
                      className="py-2 pr-3 text-right font-medium"
                    >
                      Step {index + 1}
                    </th>
                  ))}
                  <th className="py-2 text-right font-medium">Converted</th>
                </tr>
              </thead>
              <tbody>
                {report.segments.map((segment) => (
                  <tr key={segment.value} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-mono">{segment.value}</td>
                    {segment.counts.map((count, index) => (
                      <td
                        key={index}
                        className="py-2 pr-3 text-right tabular-nums"
                      >
                        {count.toLocaleString()}
                      </td>
                    ))}
                    <td className="py-2 text-right font-medium tabular-nums">
                      {percent(
                        segment.counts.at(-1) ?? 0,
                        segment.counts[0] ?? 0,
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
