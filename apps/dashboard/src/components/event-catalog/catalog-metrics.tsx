import type { AnalyticsEventCatalog } from "@logly/utils";

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <div className="rounded-xl border bg-white px-4 py-3 shadow-soft">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">
        {value.toLocaleString()}
      </p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}

export function CatalogMetrics({
  catalog,
}: {
  catalog: AnalyticsEventCatalog;
}) {
  const events = catalog.events;
  const count = (test: (event: (typeof events)[number]) => boolean) =>
    events.filter(test).length;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      <Metric
        label="Event names"
        value={events.length}
        hint={catalog.truncated ? "First 500 shown" : "All time"}
      />
      <Metric
        label="Active"
        value={count((event) => event.status === "active")}
        hint={`Seen in ${catalog.staleDays} days`}
      />
      <Metric
        label="Stale"
        value={count((event) => event.status === "stale")}
        hint={`Quiet ${catalog.staleDays}+ days`}
      />
      <Metric
        label="Naming hints"
        value={count((event) => event.similar.length > 0)}
        hint="Likely duplicates"
      />
      <Metric
        label="Deprecated"
        value={count((event) => event.deprecated)}
        hint={`${count((event) => event.hidden)} hidden from pickers`}
      />
    </div>
  );
}
