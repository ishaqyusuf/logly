# @ishaqyusuf/logly-server

Trusted server event and read client for Logly.

```bash
bun add @ishaqyusuf/logly-core @ishaqyusuf/logly-server
```

```ts
import { createServerAnalytics } from "@ishaqyusuf/logly-server";

const analytics = createServerAnalytics({
  project: "afterservice",
  collectorUrl: process.env.LOGLY_COLLECTOR_URL!,
  serverKey: process.env.LOGLY_SERVER_KEY!,
});

await analytics.track("afterservice.follow_up_created", { channel: "email" });
```

Use a project-scoped `server-write` key. Do not expose it through a public
environment variable or send PII in event properties.

## Request-scoped groups and stable retry IDs

```ts
await analytics.track("order_created", { channel: "pos" }, opaqueUserReference, {
  groups: { business: { key: opaqueTenantReference, properties: { name: "Example shop" } } },
  eventId: persistedEventUuid,
  occurredAt: originalOccurrenceIso,
});
```

The optional fourth argument preserves the existing actorId third argument.
Context is per call, never shared mutable server state. Use opaque project-scoped
references derived by your backend from authorized identity. Group validation
shares the core bounded contract. Persist the event ID/time when implementing
retries; the SDK does not implement an outbox. Server credentials must never
enter browser bundles. Group claims do not authorize merchant reporting reads.

## Breakdown reads

```ts
const logly = createAdminClient({ collectorUrl, readKey: projectReadKey });
const result = await logly.breakdown({
  project: "my-project",
  start: "2026-11-01T00:00:00Z",
  end: "2026-11-08T00:00:00Z", // exclusive
  by: ["name", "property:channel"],
  metrics: ["events", "actors", "groups"], // groups = distinct "business" keys
  interval: "day",
  limit: 10, // top values per dimension; the rest become "(other)"
  durationProperty: "duration_ms", // p50/p95 per bucket
});
```

Missing property values are reported as `(none)`. Invalid queries are rejected
by the collector with HTTP 400.
