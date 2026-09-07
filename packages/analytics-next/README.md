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

Automatic pageviews are opt-in and record pathname only. Declarative click
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
