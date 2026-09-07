import { Badge } from "@logly/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@logly/ui/card";
import type { AnalyticsAcquisitionSummary } from "@logly/utils";

export function AcquisitionReport({
  summary,
}: {
  summary: AnalyticsAcquisitionSummary;
}) {
  return (
    <section aria-label="Acquisition report" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">Where visits come from</h3>
        <Badge variant="outline">
          {summary.totalVisits.toLocaleString()} visitor-day arrivals
        </Badge>
      </div>
      <div className="grid min-w-0 gap-6 lg:grid-cols-2">
        <AcquisitionCard
          title="Referrers"
          description="Sites that brought visitors here"
          rows={summary.referrers}
          total={summary.totalVisits}
          missing="Direct / unknown includes visits without a referrer."
        />
        <AcquisitionCard
          title="Campaign sources"
          description="Attribution from the UTM source on arrival"
          rows={summary.campaignSources}
          total={summary.totalVisits}
          missing="Unattributed means no campaign source was captured."
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Counts the first browser visit each day. Later pageviews and server
        events are excluded. Shares cover the selected project's last 30 days.
      </p>
    </section>
  );
}

function AcquisitionCard({
  title,
  description,
  rows,
  total,
  missing,
}: {
  title: string;
  description: string;
  rows: Array<{ label: string; count: number }>;
  total: number;
  missing: string;
}) {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">
            No browser visits in this period. Arrivals will appear after the
            next tracked visit.
          </p>
        ) : (
          <ol className="flex flex-col gap-4">
            {rows.slice(0, 8).map((row) => {
              const share = total ? (row.count / total) * 100 : 0;
              return (
                <li key={row.label} className="flex min-w-0 flex-col gap-2">
                  <div className="flex items-center gap-3 text-xs">
                    <span className="min-w-0 flex-1 break-all">
                      {row.label}
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {row.count.toLocaleString()}
                    </span>
                    <span className="w-12 shrink-0 text-right tabular-nums text-muted-foreground">
                      {share.toFixed(1)}%
                    </span>
                  </div>
                  <div
                    className="h-1.5 overflow-hidden rounded-full bg-muted"
                    aria-hidden="true"
                  >
                    <div
                      className="h-full rounded-full bg-foreground"
                      style={{ width: `${share}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
      <CardFooter>
        <p className="text-xs text-muted-foreground">
          {rows.length > 8 ? `Top 8 of ${rows.length} sources. ` : ""}
          {missing}
        </p>
      </CardFooter>
    </Card>
  );
}
