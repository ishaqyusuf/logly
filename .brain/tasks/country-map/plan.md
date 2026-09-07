## LGL-109: Implement country visit analytics

Add a country-shaded world map and ranked visit counts to Insights, using the existing selected-project/30-day summary.

## Files To Touch

Reuse: Insights composition, shadcn Card/Badge/Button, complete-window acquisition SQL and same-origin proxy seam. Midday metrics/lazy-chart and DB report boundaries inspected; REST remains the accepted Logly boundary.
Extend: nullable event country column, collector trusted request metadata, Next proxy forwarding, summary contract and SQL grouping.
Create: country normalization/aggregation, self-hosted Natural Earth SVG geometry, country report, unit/SQL fixtures.
Avoid: GPS, IP persistence, city precision, browser-supplied country event properties, assigning the proxy server's country, historical backfill guesses.

## Execution Checklist

- [x] Capture country at Vercel product proxy; missing metadata remains unknown.
- [x] Generate and apply additive migration; preserve retries and scoped aggregation.
- [x] Compose accessible responsive map and complete ranked list with unknown counts.
- [x] Validate unit/SQL behavior, builds, desktop/mobile visual states.
- [ ] Update Brain contracts and deploy Logly via the existing pipeline.

## Validation

Source tests, typecheck, lint, dashboard build; local-only SQL fixture proves counts, isolation, unknowns and idempotency; authenticated Chrome desktop/mobile map interactions and screenshots.

## Open Questions

None. Visits retain Logly's visitor-day arrival semantics. Old proxy versions require forwarding updates; delayed delivery locates the sending network at receipt time. No third-party lookup or map runtime requests.
