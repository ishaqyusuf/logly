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
| 2 | Deploy markers | Built (see below); visual QA pending | Optional but needed to see markers: record each deploy. See "Deploy markers setup" below. |
| 3 | Tracking alerts | Built (`6eed75e`) | Nothing. Evaluated on dashboard reads (ADR 0013); in-dashboard only until feature 8 adds email. |
| 4 | App version adoption | Built (`b58bfe5`); authenticated-page visual QA pending | Mobile events must carry `appVersion`/`appBuild` from `expo-application`. gnd: enable Logly in store builds. ewatrade: send the native version and build. halaal-coperative: send both. See "App version adoption setup" below. |
| 5 | Retention | Built (`85cc8d1`); authenticated-page visual QA pending | Nothing. Uses `site_visit` (web SDK) and `app_session` (mobile clients), which every project already sends. See "Retention notes" below. |
| 6 | Funnel builder | Built (`39993f7`, migration `0011`); authenticated-page visual QA pending | No SDK upgrade or config. Funnels can only use events a project already sends, so useful funnels need new browser/mobile events: gnd quote events, school-clerk and halaal-coperative milestone events, and a forwarded `visitorId` on the server milestones of plot-keys and after-service. ewatrade storefront requests work today. See "Funnel setup" below. |
| 7 | Event catalog | Not started | Expected: nothing; add descriptions in the dashboard. |
| 8 | Weekly email digest | Built (`e9fa14a`, migration `0013`); Settings section visual QA pending | Nothing. No SDK upgrade, event or config change; digests and alert emails are configured in Logly (Settings → Email). Logly itself needs Resend and Vercel setup before release; see "Email digest setup" below. |

## Deploy markers setup (feature 2)

Needs `@ishaqyusuf/logly-server` 0.4.0 once published (unreleased in the repo
today). Until then, use the curl snippet; it needs no package.

For each deployed surface (one Logly project each, e.g. ewatrade dashboard,
marketing and storefront separately):

1. Use the project's existing `server-write` key (gnd, plot-keys and
   after-service already have one for server events). Others issue one in
   Logly → Settings → Project keys → `server-write`. Never expose it as a
   `NEXT_PUBLIC_*` variable.
2. Add build/CI environment variables (Vercel: Production and Preview scope):
   `LOGLY_COLLECTOR_URL=https://logly-chi.vercel.app`,
   `LOGLY_PROJECT=<project slug>`, `LOGLY_SERVER_KEY=<server-write key>`.
3. Pick one trigger:
   - Vercel-built web apps (gnd, ewatrade, halaal-coperative, plot-keys,
     school-clerk, after-service web): add `@ishaqyusuf/logly-server@^0.4.0`
     as a dev dependency of the deployed app and
     `"postbuild": "logly-release"` to its `package.json` (the app's own, not
     the monorepo root, so each app reports its own project). It uses the Vercel
     commit SHA (12 chars), `VERCEL_ENV` (production/preview), the commit
     subject and the deployment URL. In Turbo repos, pass the four variable
     names through `turbo.json` (`passThroughEnv` or `env`) for the build task,
     plus `VERCEL_ENV`, `VERCEL_GIT_COMMIT_SHA`, `VERCEL_GIT_COMMIT_MESSAGE`
     and `VERCEL_URL`.
   - GitHub Actions deploys (or for exact go-live markers): after the deploy
     step, run `bunx --package @ishaqyusuf/logly-server logly-release` with the
     three variables (key from secrets) and `LOGLY_RELEASE_ENVIRONMENT`.
   - Mobile releases (gnd, ewatrade, halaal-coperative EAS builds/updates):
     call `logly-release` (or curl) after `eas update`/`eas submit` with
     `LOGLY_RELEASE_VERSION=<app version or update group>` against the mobile
     project.
   - after-service jobs need nothing; markers belong to deployed surfaces.
4. Without the package: the curl + `openssl dgst -sha256 -hmac` snippet in
   `packages/analytics-server/README.md`.
5. Check: Logly → Settings → Releases lists the deploy; the Overview chart
   shows a marker on that day/hour. A deploy can also be added there by hand.

Nothing else changes: no SDK upgrade is required for analytics itself, and
a failed release call never fails the build (unless `--strict`).

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

## Retention notes (feature 5)

No SDK upgrade, migration, env var or code change is needed. The Retention
page (`/retention`) starts cohorts at each visitor's first `site_visit` (web,
sent automatically by `@ishaqyusuf/logly-core`) or `app_session` (the gnd,
ewatrade and halaal-coperative native clients all emit it). Checked
2026-11-24, read-only.

Things that make a project's numbers lower than reality:

- Visitor IDs are per browser or install and reset when storage clears, so
  all retention is a lower bound.
- ewatrade and halaal-coperative mobile clients reset the visitor when the
  identity or context scope changes (`native.ts`, see the feature 4 notes), so
  an account switch looks like a new user who never returned.
- gnd store builds disable Logly (`EXPO_PUBLIC_LOGLY_ENABLED: "false"`), so
  gnd mobile retention stays empty until that is enabled.

## Funnel setup (feature 6)

The funnel builder (`/funnels`) needs no SDK upgrade, env var or route change.
It counts ordered steps per project-scoped `visitorId` (ADR 0018), so:

- Each step must be an explicit event the project already sends (or
  `page_view` on a route template, once steps 1–2 above are done).
- Events without a `visitorId` are excluded. Trusted server events
  (`@ishaqyusuf/logly-server`) join a browser funnel only when the server call
  forwards the browser's `visitorId` (read it from the request that the
  browser SDK made, never derive it from a user ID). Otherwise send the
  milestone from the browser after the server confirms success.
- Use snake_case names (`^[a-z][a-z0-9_.]{0,79}$`) and keep properties to
  short, non-identifying values; a funnel filter can only use property keys
  Logly has already stored for that event.

Key funnels and what each project must track (read-only check of each repo,
2026-11-24):

| Project | Key funnel | Tracked today | What to add |
| --- | --- | --- | --- |
| gnd | Staff quote: opened → edited → sent; customer: accept page viewed → accepted | Web allowlist is only `site_visit`, `page_view`, `dealer_program_progress_viewed`; mobile sends `app_session`, `screen_view`, `job_opened`, `sales_order_opened`, `document_viewed`, `notification_opened`. No quote events. | Add `quote_opened`, `quote_edited`, `quote_sent` (dashboard, browser) and `quote_accepted` (accept-quote page, browser, after the server confirms) to `packages/events/src/policy.ts` `webEvents` and track them. Optional property `quote_type`. Staff and customer are different visitors, so these are two funnels, not one. Until then: `page_view` on `/sales-book/edit-quote/:id`. Mobile quote funnels need `quote_opened` added to `mobileEvents` (and Logly enabled in store builds, feature 4). |
| ewatrade | Storefront: viewed → request started → request submitted (or WhatsApp clicked) | `storefront_request_started`, `storefront_request_submitted`, `storefront_whatsapp_clicked`, `storefront_link_shared` from the storefront browser client, plus `site_visit`/`page_view`. | Nothing for the storefront funnel. For dashboard onboarding, add milestones such as `store_created`, `first_product_added`, `first_order_received` from the browser. |
| halaal-coperative | Member: registered → contribution made → loan requested → repayment made | Only `site_visit`/`page_view` (web) and `app_session` (mobile). | Track `member_registered`, `contribution_made`, `loan_requested`, `loan_approved`, `repayment_made` from the dashboard/mobile after each succeeds. The mobile visitor resets on context changes (feature 4 notes), which breaks cross-context funnels. |
| plot-keys | Agent: onboarding completed → property created → website published | `plotkeys.onboarding_completed`, `plotkeys.property_created`, `plotkeys.website_published`, `plotkeys.contact_submitted`, `plotkeys.early_access_requested`, all server-side `trackEvent` calls without a `visitorId`. | Forward the browser `visitorId` into those `trackEvent` calls (or emit them from the browser on success). Nothing else. |
| school-clerk | School: onboarding → first student added → first result published | Only `site_visit`/`page_view`. | Track `onboarding_completed`, `student_added`, `result_published`, `fee_payment_recorded` from the browser. |
| after-service | Workspace: customer created → service job created → follow-up message sent | `customer_created`, `service_job_created`, `message_sent`, `follow_up_status_updated` as server events keyed by actor, not visitor; browser `site_visit`. Its `packages/events/src/events.ts` catalog (`pricing_viewed`, `cta_clicked`, `user_signed_in`, `subscription_started`, …) is used by the website, but local Logly data shows none of these arriving. | Forward the browser `visitorId` on the server milestones, or emit them from the browser. Confirm the catalog events reach Logly through the browser SDK; then a marketing funnel (`pricing_viewed` → `cta_clicked` → `user_signed_in` → `subscription_started`) works. |

## Email digest setup (feature 8)

Product projects do nothing. The digest reads data they already send: visitors
and events from every project, top pages from `page_view`/`screen_view`
(better once steps 1–2 land), releases from deploy markers (feature 2) and
tracking alerts (feature 3). Projects that set `timezone` get their own
Monday–Sunday; all are UTC today.

Logly (one-time, by the user, before the coordinated release):

1. Resend: create the account, add and verify a sending domain (DNS records
   at the domain's registrar), create an API key with send access.
2. Vercel → logly → Settings → Environment Variables, **Production** only:
   `RESEND_API_KEY`, `EMAIL_FROM` (`Logly <digest@verified-domain>`),
   `CRON_SECRET` (random, 16+ characters; Vercel sends it to the cron),
   optional `EMAIL_REPLY_TO`. Keep `NEXT_PUBLIC_DASHBOARD_URL` or
   `BETTER_AUTH_URL` set to the public dashboard URL (email links use it).
   Do not add the email keys to Preview; preview never sends anyway.
3. `vercel.json` declares the cron (`/api/cron/email`, daily 07:00 UTC),
   which a Hobby plan allows. Check it under Settings → Cron Jobs after the
   deploy. On a Pro plan the schedule can be made hourly for faster alert
   emails.
4. After the deploy (migration `0013` runs in `deploy:prepare`): Settings →
   Email → opt operators in per project or organization, open "Preview
   digest", then "Send test digest to me".
