import { Badge } from "@logly/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@logly/ui/card";
import type { AnalyticsCollectionHealth } from "@logly/utils";

export function CollectionHealth({
  health,
  mode,
}: {
  health: AnalyticsCollectionHealth;
  mode: "demo" | "database";
}) {
  const observed = mode === "database" && health.lastReceivedAt;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Collection health</CardTitle>
        <CardDescription>
          Observed persistence in the last 24 hours
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <Badge variant="outline" className="self-start">
          {mode === "demo"
            ? "Not measured in demo"
            : observed
              ? "Arrival data available"
              : "No arrivals yet"}
        </Badge>
        <dl className="flex flex-col gap-4 text-sm">
          <div>
            <dt className="text-muted-foreground">Events received</dt>
            <dd className="mt-1 text-2xl tabular-nums">
              {mode === "demo" ? "—" : health.recentEvents.toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Average arrival lag</dt>
            <dd className="mt-1 tabular-nums">
              {mode === "database" && health.averageLagSeconds !== null
                ? `${health.averageLagSeconds.toFixed(1)} seconds`
                : "Not measured"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Last received (UTC)</dt>
            <dd className="mt-1 break-words">
              {observed
                ? new Date(observed)
                    .toISOString()
                    .replace("T", " ")
                    .replace(/\.\d+Z$/, " UTC")
                : "No observation"}
            </dd>
          </div>
        </dl>
        {health.clockSkewEvents > 0 && (
          <p className="text-xs text-muted-foreground">
            {health.clockSkewEvents} events have timestamps ahead of receipt and
            are excluded from average lag.
          </p>
        )}
      </CardContent>
      <CardFooter>
        <p className="text-xs text-muted-foreground">
          Lag includes batching, offline time, and client clock differences.
          Delivery success rate is unknown: events that never arrive cannot be
          measured here.
        </p>
      </CardFooter>
    </Card>
  );
}
