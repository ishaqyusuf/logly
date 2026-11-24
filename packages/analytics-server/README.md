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

## Deploy markers

Record each release so the Logly dashboard draws it as a marker on its charts.
The call is signed with the same `server-write` key and is idempotent on
project, environment and version, so retries are safe.

```ts
await analytics.release({
  version: process.env.VERCEL_GIT_COMMIT_SHA!.slice(0, 12), // or "1.4.0"
  environment: "production", // or "preview"
  description: "Checkout redesign", // optional, up to 280 characters
  url: "https://github.com/acme/shop/releases/tag/v1.4.0", // optional
});
```

### From CI or a build script

The package ships a `logly-release` command. It reads `LOGLY_COLLECTOR_URL`,
`LOGLY_PROJECT` and `LOGLY_SERVER_KEY`, takes the version, environment,
description and URL from Vercel (`VERCEL_GIT_COMMIT_SHA`, `VERCEL_ENV`,
`VERCEL_GIT_COMMIT_MESSAGE`, `VERCEL_URL`) or GitHub Actions (`GITHUB_SHA`)
variables, and lets `LOGLY_RELEASE_VERSION`, `LOGLY_RELEASE_ENVIRONMENT`,
`LOGLY_RELEASE_DESCRIPTION` and `LOGLY_RELEASE_URL` override them. It logs a
warning instead of failing the build unless you pass `--strict`.

Vercel deploy hooks only trigger builds; they cannot call Logly. Use one of:

```jsonc
// package.json of the deployed app: runs at the end of every Vercel build
// (production and preview; skipped on `vercel dev`).
{ "scripts": { "postbuild": "logly-release" } }
```

A `postbuild` marker is recorded when the build finishes, shortly before the
deployment goes live, and also for builds that later fail to deploy. For exact
markers, call it after the deploy step in GitHub Actions:

```yaml
- name: Record Logly release
  if: success()
  run: bunx --package @ishaqyusuf/logly-server logly-release
  env:
    LOGLY_COLLECTOR_URL: https://logly-chi.vercel.app
    LOGLY_PROJECT: my-project
    LOGLY_SERVER_KEY: ${{ secrets.LOGLY_SERVER_KEY }}
    LOGLY_RELEASE_ENVIRONMENT: production
```

### With curl

```bash
body=$(printf '{"project":"%s","version":"%s","environment":"production","description":"%s"}' \
  "$LOGLY_PROJECT" "${GITHUB_SHA:0:12}" "Release notes")
signature=$(printf '%s' "$body" | openssl dgst -sha256 -hmac "$LOGLY_SERVER_KEY" | awk '{print $NF}')
curl -fsS -X POST "$LOGLY_COLLECTOR_URL/v1/releases" \
  -H "content-type: application/json" \
  -H "authorization: Bearer $LOGLY_SERVER_KEY" \
  -H "x-logly-signature: $signature" \
  --data-raw "$body"
```

`201` means recorded, `200` means that version was already recorded.
