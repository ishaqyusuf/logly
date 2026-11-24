# 0012. Record route templates in the SDK

Accepted 2026-11-24 after the GND dashboard reported most page views as
`/other`.

GND kept route data safe with a product-side allowlist of top-level sections.
Every unlisted section collapsed to `/other`, and listed sections lost all
depth. Raw pathnames would fix reporting but send record ids, slugs and tokens
to the collector.

Templating now happens in `@ishaqyusuf/logly-core` before an event is queued,
like PostHog path cleaning but on the device. `normalizeRoute` drops query
strings and fragments and replaces UUIDs, segments with three or more digits,
segments over 40 characters and non-word segments with `:id`. Version segments
(`v2`) stay. Depth is capped at 6 segments by default.

Projects add rules through `routeTemplates`: `redactPrefixes` keeps only the
prefix of token links, `idParents` marks segments whose child is always an id,
and `keep` exempts segments. `routeTemplates: false` restores raw pathnames.
`@ishaqyusuf/logly-native` uses the same default and accepts the same options;
its `sanitizeRoute` override still replaces templating entirely.

Browser page views are deduplicated on the concrete path so visiting two
records counts twice. The collector contract is unchanged (`route` is still an
optional string of up to 256 characters). No migration or backfill: earlier
events keep their recorded routes.

Templating is on by default, which changes recorded routes for existing
consumers on upgrade. Release it with a minor version and a changelog note. It
is not published yet and shares the unreleased 0.3.0 work in the same
packages.
