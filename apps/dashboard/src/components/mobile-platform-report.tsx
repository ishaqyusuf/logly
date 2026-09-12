import { Badge } from "@logly/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@logly/ui/card";
import type { AnalyticsMobileSummary } from "@logly/utils";
import { MonitorSmartphone, Smartphone } from "lucide-react";

export function MobilePlatformReport({
  summary,
}: {
  summary: AnalyticsMobileSummary;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <CardTitle>Mobile usage</CardTitle>
          <CardDescription>
            Android and iOS sessions, installations, events, and releases over
            the last 30 days.
          </CardDescription>
        </div>
        <MonitorSmartphone className="size-5 text-muted-foreground" />
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="App sessions" value={summary.totalSessions} />
          <Metric label="Installations" value={summary.uniqueInstallations} />
          <Metric label="Mobile events" value={summary.totalEvents} />
        </div>

        {summary.platforms.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {summary.platforms.map((platform) => (
              <div
                key={platform.platform}
                className="flex min-w-0 flex-col gap-4 rounded-xl border bg-muted/20 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Smartphone className="size-4 text-muted-foreground" />
                    <span className="text-sm font-medium capitalize">
                      {platform.platform}
                    </span>
                  </div>
                  <Badge variant="outline">
                    {summary.totalSessions
                      ? Math.round(
                          (platform.sessions / summary.totalSessions) * 100,
                        )
                      : 0}
                    % of sessions
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <PlatformMetric label="Sessions" value={platform.sessions} />
                  <PlatformMetric
                    label="Installations"
                    value={platform.installations}
                  />
                  <PlatformMetric label="Events" value={platform.events} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
            No mobile events in this period. Android and iOS appear separately
            after the first app session arrives.
          </p>
        )}

        {summary.versions.length ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h4 className="text-sm font-medium">App versions</h4>
                <p className="text-xs text-muted-foreground">
                  Release adoption by platform and build
                </p>
              </div>
              <span className="text-xs font-medium text-muted-foreground">
                Sessions · Events
              </span>
            </div>
            <ol className="flex flex-col gap-1">
              {summary.versions.slice(0, 8).map((version) => (
                <li
                  key={`${version.platform}-${version.version}-${version.build ?? "unknown"}`}
                  className="flex min-w-0 items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm hover:bg-muted/50"
                >
                  <span className="min-w-0 truncate">
                    <span className="capitalize">{version.platform}</span>{" "}
                    {version.version}
                    {version.build ? ` (${version.build})` : ""}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {version.sessions.toLocaleString()} ·{" "}
                    {version.events.toLocaleString()}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
        <p className="text-xs text-muted-foreground">
          Installations use a project-scoped pseudonymous ID. Logly does not
          collect device advertising IDs, GPS, email addresses, or raw user IDs.
        </p>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-medium tabular-nums">
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function PlatformMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium tabular-nums">{value.toLocaleString()}</p>
    </div>
  );
}
