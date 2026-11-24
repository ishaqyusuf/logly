# 0011. Opt into Cloudflare visitor country at the product edge

Accepted 2026-10-24 for the user's Afterservice/Logly country request.

Preserve default Vercel-only behavior for existing SDK consumers. Add
`trustCloudflareCountry` as an explicit product-deployment option. On Vercel,
when enabled and Cloudflare metadata is present, prefer the visitor's
`cf-ipcountry`. If Cloudflare supplies no usable location, keep it unknown
instead of attributing the proxy's Vercel country.

Consumers must supply/overwrite these headers at trusted ingress. This is
approximate analytics metadata, never authorization. The collector continues
to accept only credential-authenticated proxy metadata and its ISO whitelist.
No raw IP, precise location, event-body country, migration or backfill is added.

Reuse the existing Insights report and show country in event rows/details.
Afterservice installs released 0.2.1 plus a tracked Bun patch matching this
source change. Do not publish the repository's unrelated 0.3.0 work as part
of this integration. Remove the consumer patch once an official SDK release
contains this option.
