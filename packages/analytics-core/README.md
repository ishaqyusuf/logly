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

## Generic identity and groups

Call methods on the analytics client (`useAnalytics()` in Next):

```ts
analytics.identify(projectScopedUserReference);
analytics.group("business", projectScopedTenantReference, { name: "Example shop" });
analytics.setGlobalProperties({ surface: "dashboard" });
analytics.track("order_created", { channel: "pos" });
analytics.clearGroup("business");
analytics.unsetGlobalProperties(["surface"]);
analytics.reset();
```

References must be opaque and project-scoped; do not send raw authenticated IDs
or emails. Names are display metadata, never identity keys. Groups are generic:
at most five types using lowercase snake case (64 characters), each with a key
of at most 128 characters and at most 20 scalar properties (256-character strings).
Invalid `identify`/`group` calls return false and leave valid context unchanged.
Changing the actor clears group and global context; call identify before group.
No profile persistence, historical merge or authentication is implied. The app
must resolve and authorize the active tenant independently.

Events copy context when captured, including queued events. Group changes cannot
relabel earlier events. Explicit event properties override global defaults.
Reset clears actor, groups, defaults and pending events and rotates visitor identity;
it cannot recall an already dispatched network request. Context is memory-only,
so reapply it after reload. Await native reset before tracking a new account.
Public storefront attribution must come from verified server-resolved site context.
Do not use client group claims as a merchant reporting authorization boundary.

Complete serialized events have a 47 KiB UTF-8 budget (batch-envelope headroom).
Oversized captures are rejected before queueing; browser track returns false.
Native reset cancels pending initialization; call init again if reset interrupted
initial startup. Pending persisted visitor/queue writes are ordered before reset.
