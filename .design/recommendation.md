# Recommended direction — Signal Desk

Choose **Variant A: Signal Desk** as the Logly dashboard direction.

It best answers the two questions the thin product must own:

1. What changed in this project?
2. Can I trust the events I am seeing?

It adds a real analytics home without widening Logly into OpenPanel, PostHog, or a report builder. The main chart is the visual anchor; top events and recent events provide a fast drill-down; collection health makes the data trustworthy; the complete monolithic table moves to its proper Events page.

## What to merge from the alternatives

- From Variant B: a short “what changed” insight after complete comparison data is reliable.
- From Variant C: delivery, rejected batch, and last-event signals inside Collection Health.
- Do not adopt Variant B’s icon-only navigation or Variant C’s infrastructure-first default.

## Recommended route sequence

1. [Overview](recommended/overview.html)
2. [Events](recommended/events.html)
3. [Projects](recommended/projects.html)
4. [Settings](recommended/settings.html)
5. [System states](recommended/states.html)

## Implementation order

1. Separate Overview from Events while preserving current URL/filter contracts.
2. Add complete-window time-series and top-event aggregate APIs in the DB/read boundary.
3. Add the shadcn sidebar/chart/toggle/empty/alert primitives to `@logly/ui`.
4. Build Overview with server-prefetched aggregates and explicit loading/error states.
5. Move the current event explorer to Events and replace its mobile table with a compact list/detail sheet.
6. Rework Projects into a portfolio health table.
7. Split project settings into origins, keys, collector status, and privacy sections.
8. Run authenticated Chrome QA at 375, 768, 1024, and 1440px.

## Non-goals

- Custom dashboard builder
- Saved arbitrary reports
- Funnels, cohorts, sessions, user profiles, heatmaps, or replay
- AI analytics assistant
- Automatic DOM/form capture
- Email/raw-user/cross-project identity reporting

## Decision status

This is the agent’s recommendation for user review. It is not an implementation approval or an architecture decision yet.
