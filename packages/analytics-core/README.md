# @ishaqyusuf/logly-core

Framework-independent contracts and browser client for a deliberately small
Logly integration: one visitor-day, automatically discovered events, bounded
properties, and durable batched same-origin delivery.

```bash
bun add @ishaqyusuf/logly-core
```

```ts
import { createAnalytics } from "@ishaqyusuf/logly-core";

const analytics = createAnalytics({
  project: "afterservice",
  endpoint: "/api/analytics",
  permission: () => "allowed",
});

analytics.init();
analytics.track("cta_clicked", { cta: "join_beta" });
analytics.trackPageView({ route: "/pricing" });
```

The project supplies the permission decision. Permission must be allowed before
the client creates or reads its project-scoped local visitor ID. The first-ever
visitor event is delivered immediately. Later visits and events are queued in
IndexedDB and flush after 60 seconds, at 25 events, at 48 KiB of queued payload,
on page lifecycle changes, or when connectivity returns. Failed batches retain
their original event IDs for idempotent retry and are removed only after a 2xx
collector response.

The queue defaults to 250 events retained for 24 hours. Override
`flushIntervalMs`, `flushAt`, `maxQueueEvents`, or `maxQueueAgeMs` at
initialization when an integration needs stricter limits. Local storage is used
only for the small project-scoped visitor record; cookies are not used.
