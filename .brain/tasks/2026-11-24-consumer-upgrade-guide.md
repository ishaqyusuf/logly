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
| 1 | Pages report | Built (`6eed75e`); visual QA pending | Nothing required. To see real pages: web projects need core/next 0.3.0 with `autoTrackPageViews` and steps 1–2; mobile projects need `logly-native` 0.1.0 (or `normalizeRoute`) calling `trackScreenView`. Older events keep raw paths or `/other`; no backfill. |
| 2 | Deploy markers | Not started | Expected: call a release endpoint from CI or a deploy hook. |
| 3 | Tracking alerts | Built (`6eed75e`) | Nothing. Evaluated on dashboard reads (ADR 0013); in-dashboard only until feature 8 adds email. |
| 4 | App version adoption | Built (`b58bfe5`); authenticated-page visual QA pending | Mobile events must carry `appVersion`/`appBuild` from `expo-application`. gnd: enable Logly in store builds. ewatrade: send the native version and build. halaal-coperative: send both. See "App version adoption setup" below. |
| 5 | Retention | Not started | Expected: nothing. |
| 6 | Funnel builder | Not started | Expected: nothing beyond the events already tracked. |
| 7 | Event catalog | Not started | Expected: nothing; add descriptions in the dashboard. |
| 8 | Weekly email digest | Not started | Expected: nothing; recipients set in Logly. |

## App version adoption setup (feature 4)

The Versions page (`/versions`) needs every mobile event to carry `appVersion`
and `appBuild` (plus `platform` and a stable per-install visitor). No Logly SDK
upgrade, migration or env var is needed. Findings from reading each client
(2026-11-24, read-only):

| Project | Sends `appVersion` / `appBuild` today? | What to do |
| --- | --- | --- |
| gnd | Yes. `apps/mobile/src/runtime/analytics-runtime.tsx:36-37` uses `expo-application` `nativeApplicationVersion` / `nativeBuildVersion`; `Platform.OS` gives ios/android. | Nothing for the client. But `eas.json` sets `EXPO_PUBLIC_LOGLY_ENABLED: "false"` for the production iOS and `play` profiles (and `app.config.ts` blocks enabling it in public builds), so store builds send no events and the report stays empty for them. Enable Logly in those profiles when ready. |
| ewatrade | Partly. `appVersion` is `Constants.expoConfig?.version` (`analytics-runtime.tsx:148`), the manifest `"1.0.0"` that never changes because EAS manages versions remotely. `appBuild` is `Constants.nativeBuildVersion` (line 149), removed from `expo-constants` 18, so it is always missing. | Add `expo-application` to `apps/mobile` and send `Application.nativeApplicationVersion` / `Application.nativeBuildVersion`. Its contract (`native-contract.ts:15-24`: semver-like version, digits-only build) already accepts these. `expo-application` is a native module, so this ships in a new store build, not an OTA update. Optional: the visitor ID resets when the identity context changes (`native.ts:182-202`), which overcounts users after account switches. |
| halaal-coperative | No. `Constants.nativeAppVersion` / `Constants.nativeBuildVersion` (`analytics-runtime.tsx:48-49`) were removed from `expo-constants` 18, so every event lands in Unknown. | Same fix as ewatrade: add `expo-application`, send `nativeApplicationVersion` / `nativeBuildVersion`, ship in a new store build. Optional: the visitor resets on context-scope changes (`native.ts:163-179`). |

Moving any of them to `@ishaqyusuf/logly-native` 0.1.0 also works: pass the
same `expo-application` values as `appVersion` / `appBuild` in its config.

The report measures native binary versions. EAS Update (OTA) releases do not
change `appVersion`, so OTA adoption is not visible; that would need
`runtimeVersion`/`updateId` in the event contract and SDKs (follow-up).
Web-only projects (plot-keys, school-clerk, after-service) need nothing; the
page shows an explanatory empty state for them.
