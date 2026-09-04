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
