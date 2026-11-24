# Consumer upgrade guide — SDK 0.3.0 and the 8 new features

Started 2026-11-24. Living document: each feature session adds what product
projects must do once its feature lands. Release of the 8 features is held until
all are done.

## Projects using Logly

| Project | Path | SDK installed | Surfaces | Route handling today |
| --- | --- | --- | --- | --- |
| gnd | `~/Documents/code/_turbo/gnd` | core ^0.2.0, next ^0.2.1, server ^0.2.0 | web, mobile (own native client) | Own template normalizer in `packages/events/src/policy.ts` (commit `e091240be`) |
| ewatrade | `~/Documents/code/ewatrade` | core 0.2.0, next 0.2.1 (exact pins) | dashboard, marketing, storefront, mobile (own native client) | Allowlist: first segment (+ second) else `/other` |
| halaal-coperative | `~/Documents/code/halaal-coperative` | core ^0.2.0, next ^0.2.1 | dashboard, marketing, mobile (own native client) | Allowlist: first segment else `/other` |
| plot-keys | `~/Documents/code/plot-keys` | core ^0.2.0, next ^0.2.1, server ^0.2.0 | web | Allowlist: root + `/:detail` else `/other` |
| school-clerk | `~/Documents/code/school-clerk` | core ^0.2.0, next ^0.2.1 | web | Allowlist: first segment else `/other` |
| after-service | `~/Documents/code/micro-startups/after-service` | core ^0.2.0, next ^0.2.1, server ^0.2.0 | web, jobs (server) | No route policy: raw pathname (ids included) |

Release copies and worktrees (`_release/*`, `.school-clerk-release-*`,
`.ewatrade-release-*`, `ewatrade-dashboard-design`, `gnd-activity-fix`) are
not separate consumers.

## Step 1 — every project: upgrade to 0.3.0

`^0.2.x` does not pick up 0.3.0 (caret on 0.x stays within the minor), so each
project must bump explicitly:

```bash
bun add @ishaqyusuf/logly-core@^0.3.0 @ishaqyusuf/logly-next@^0.3.0
```

Add `@ishaqyusuf/logly-server@^0.3.0` where the project already uses the server
package (gnd, plot-keys, after-service).

What changes on upgrade:

- Routes are recorded as templates (`/orders/:id`) by default. See
  [ADR 0012](../decisions/0012-sdk-route-templates.md).
- Group analytics (`identify`, `group`, global properties) become available.
  Optional; see [group analytics](../features/group-analytics.md).

## Step 2 — replace product route allowlists

ewatrade, halaal-coperative, plot-keys and school-clerk collapse every
unlisted section into `/other`, so the Pages report (feature 1) will show
little for them. In each project's `packages/events/src/policy.ts`:

1. Replace the `safeRoute` allowlist with `normalizeRoute` or
   `createRouteNormalizer` from `@ishaqyusuf/logly-core`.
2. Move token-carrying routes (password reset, invites, shared links,
   checkout, tenant tokens: the cases the old tests assert become `/other`)
   into `redactPrefixes`.
3. Add `idParents` for routes whose ids look like words (slugs).
4. Pass the same options to the browser client as `routeTemplates`, and keep
   calling the normalizer in the proxy's `safeBatch` as a server-side guard.
5. Update the policy tests: unlisted sections now keep their name; tokens
   still never appear.

gnd already records templates through its own normalizer and can switch to
`createRouteNormalizer` with these rules:

- `redactPrefixes`: `/p`, `/sh`, `/checkout`, `/square-payment`,
  `/square-payment-response`, `/dealer-program`, `/password-reset`,
  `/track-order`, `/sales/accept-quote`, `/sales/special-order-approval`,
  `/sales/change-approval`
- `idParents`: `edit-order`, `edit-quote`, `model-template`,
  `community-template`, `projects`, `project-units`, `customers`, `employees`,
  `item`, `job`, `contractor-payout`, `install-cost`

after-service needs no allowlist change; on 0.3.0 its raw paths become
templates automatically. Review its token routes for `redactPrefixes`.

Mobile apps (gnd, ewatrade, halaal-coperative) use their own native clients.
Either move to `@ishaqyusuf/logly-native@0.1.0` or call `normalizeRoute`
inside the existing client's screen-route sanitizer.

## Step 3 — per-feature requirements

Filled in as each feature lands.

| # | Feature | Status | What projects must do |
| --- | --- | --- | --- |
| 1 | Pages report | In progress | Steps 1–2 above, so routes arrive as templates. |
| 2 | Deploy markers | Not started | Expected: call a release endpoint from CI or a deploy hook. |
| 3 | Tracking alerts | In progress | Expected: nothing. |
| 4 | App version adoption | Not started | Expected: mobile events must carry `appVersion`/`appBuild`. |
| 5 | Retention | Not started | Expected: nothing. |
| 6 | Funnel builder | Not started | Expected: nothing beyond the events already tracked. |
| 7 | Event catalog | Not started | Expected: nothing; add descriptions in the dashboard. |
| 8 | Weekly email digest | Not started | Expected: nothing; recipients set in Logly. |
