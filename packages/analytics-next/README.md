# @ishaqyusuf/logly-next

Thin React and Next.js adapters for Logly.

```bash
bun add @ishaqyusuf/logly-core @ishaqyusuf/logly-next
```

Mount the provider in the product website:

```tsx
import { AnalyticsProvider } from "@ishaqyusuf/logly-next";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AnalyticsProvider
      project="afterservice"
      endpoint="/api/analytics"
      autoTrackPageViews
      trackAttributes
      permission={() => "allowed"}
    >
      {children}
    </AnalyticsProvider>
  );
}
```

Automatic pageviews are opt-in and record a route template such as
`/orders/:id` (see `routeTemplates` in `@ishaqyusuf/logly-core`). Declarative click
events are also opt-in:

```tsx
<button
  data-logly-event="cta_clicked"
  data-logly-prop-location="hero"
>
  Join beta
</button>
```

Only `data-logly-prop-*` attributes are included. Logly never reads element
text, form values, URLs, IDs, classes, or unrelated `data-*` attributes.

Forward batches through a same-origin route. Keys remain server-only:

```ts
import { createAnalyticsRoute } from "@ishaqyusuf/logly-next";

export const POST = createAnalyticsRoute({
  collectorUrl: process.env.LOGLY_COLLECTOR_URL,
  projectKey: process.env.LOGLY_PROJECT_KEY,
});
```

## Country analytics

Version 0.2.1 forwards Vercel's product-edge `x-vercel-ip-country` header to
the collector as `x-logly-country` when `VERCEL=1`. Keep the project key
server-only. Country is request metadata, never a browser event property.
Older adapters and deployments without trusted geographic metadata produce
unknown locations. The collector stores only validated ISO country codes,
never IP addresses or GPS coordinates. Update and deploy your product proxy
to enable country counts for new visits; historical visits remain unknown.

### Visitor country behind Cloudflare on Vercel

The same-origin route reads `x-vercel-ip-country` only in Vercel runtime.
Set `trustCloudflareCountry: true` when your deployment's trusted ingress
supplies/overwrites Cloudflare visitor headers. It then prefers `cf-ipcountry`
if that header or `cf-ray` is present. Missing/invalid Cloudflare metadata
stays unknown instead of using Vercel's proxy geography. Direct Vercel traffic
retains the default country behavior. Other runtimes send no country.

Only the normalized two-letter country is forwarded as `x-logly-country`;
incoming browser overrides and forwarded IPs are ignored. The collector
applies its ISO country whitelist. No location is added to the event body.

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
