# EwaTrade and Halaalvest integration completion

Status: Both project tasks active; shared Overview blocker repaired and deployed.

## Authorized outcome

On 2026-09-22 the user requested two new project tasks to finish Logly coverage
for each product's dashboard, marketing website, and Android application,
provision the corresponding Logly projects, and merge the implementation into
local and GitHub `main`.

Each product task owns its repository, production configuration, and its own
Logly organization. The intended workspace split is Dashboard, Marketing, and
Mobile (Android). Existing mobile workspaces may be reused; old combined web
history must be preserved because deletion was not requested. iOS, storefront,
and POS are outside this follow-up's named surfaces.

## Task ledger

| Task | Project | Creation handle | State |
| --- | --- | --- | --- |
| A-E-W01: Complete EwaTrade Logly integration | ewatrade | 01a0c810-5934-7da3-9ad0-71e7726b5337 | Active on local host |
| A-H-W01: Complete Halaalvest Logly integration | halaal-coperative | 01a0c810-7187-7e43-9b64-e423c130a314 | Active on local host |

Both thread IDs are resolved by direct task progress messages and accepted
thread tool calls. Task-list discovery did not surface the worktree threads.
Configured default models were retained.

## Acceptance checklist per product

- [ ] Verify existing release work against current source and preserve unrelated edits.
- [ ] Provision or verify separate Dashboard, Marketing, and Mobile workspaces.
- [ ] Configure per-surface Vercel/EAS routing and server-held scoped keys.
- [ ] Complete meaningful tests and independent code review.
- [ ] Merge the reviewed integration into local and GitHub main.
- [ ] Deploy dashboard and marketing and verify production event isolation.
- [ ] Release through the existing Android path and verify installed-app delivery.
- [ ] Record commits, deployment/source evidence, runtime results, and remaining blockers.

## Prior evidence

Read [the portfolio report](analytics-expansion/report.md), with later dated
entries superseding early status paragraphs. The 2026-09-22 audit found EwaTrade
analytics in main `e6634aed`, but Halaalvest's committed main `28fea89d` lacked
the integration; its pushed `codex/logly-analytics-main` branch contains it.
Halaalvest's saved checkout had 851 changed entries and must not be reset or
blanket committed. Existing deployments and Android release artifacts do not
substitute for current runtime acceptance.

## Shared Overview query repair

Halaalvest reported failed production Overview reads on 2026-09-22. Vercel
runtime logs confirmed postgres-js rejected a raw JavaScript Date used as the
previous-period exclusive upper bound. The health route remained HTTP 200.
The query now uses Drizzle's typed `lt` comparison, preserving the half-open
window and project/organization filters while applying timestamp serialization.
Regression tests exercise the actual Overview query encoder for 24h, 7d, and
30d. All three failed before the fix and pass after it; all eight DB tests and
DB typecheck pass. Commit `82b1eb5` was pushed to main and deployment
`dpl_ZoyK4Lou9jKrcsyDgSvKwpUKc3az` is Ready on the canonical production alias.
Authenticated Chrome verified Halaalvest Mobile Overview for 7d, 24h, and 30d;
metrics and collection health render successfully. Both product tasks were
notified. No schema, API, or credential change was required.

The product tasks are coordinating access to the same physical Android device.
EwaTrade reported scoped release-account authentication working; Halaalvest was
directed to coordinate the existing authentication method without sending secrets.
Product integration, merges, and installed-app acceptance remain in progress.
