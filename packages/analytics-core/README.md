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

### Route templates

Routes are recorded as page templates, not raw paths, so ids never leave the
device and reports group pages by type. Query strings and fragments are always
dropped. A segment becomes `:id` when it is a UUID, has three or more digits, is
longer than 40 characters, or is not a plain word:

| Path | Recorded |
| --- | --- |
| `/orders/04512AB/edit?tab=1` | `/orders/:id/edit` |
| `/customers/v2` | `/customers/v2` |
| `/dispatch/0f8fad5b-d9cb-469f-a165-70867728950e` | `/dispatch/:id` |

Add project rules for ids that look like words and for links that carry tokens:

```ts
createAnalytics({
  project: "afterservice",
  routeTemplates: {
    redactPrefixes: ["/checkout", "/invite"], // record only the prefix
    idParents: ["projects", "customers"], // `/projects/oak-ridge` → `/projects/:id`
    keep: ["2fa"], // never replaced
  },
});
```

Page views are still deduplicated on the concrete path, so `/orders/1` then
`/orders/2` records two views. Pass `routeTemplates: false` to record raw
pathnames. `normalizeRoute` and `createRouteNormalizer` are exported for
server and native use.

The queue defaults to 250 events retained for 24 hours. Override
`flushIntervalMs`, `flushAt`, `maxQueueEvents`, or `maxQueueAgeMs` at
initialization when an integration needs stricter limits. Local storage is used
only for the small project-scoped visitor record; cookies are not used.
