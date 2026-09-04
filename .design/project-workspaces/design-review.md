# Design review and recommendation

## Recommendation

Start implementation from **Signal Studio** and borrow Event Atlas's chart-first event-summary ordering if the event explorer becomes the most-used page.

Signal Studio is the strongest base because it stays close to the existing Midday-derived shell and table architecture, reads well at both high and low data volumes, and gives collection health enough weight without turning Logly into an operations product.

## Direction scorecard

| Direction | Clarity | Event analysis | Daily use | Build fit | Distinctive | Overall |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Signal Studio | 9 | 9 | 9 | 10 | 7 | 44/50 |
| Event Atlas | 9 | 10 | 8 | 9 | 8 | 44/50 |
| Dark Operations | 8 | 9 | 9 | 8 | 9 | 43/50 |
| Editorial Ledger | 9 | 8 | 7 | 8 | 10 | 42/50 |
| Compact Grid | 8 | 9 | 10 | 9 | 7 | 43/50 |
| Calm Monitor | 9 | 8 | 8 | 9 | 8 | 42/50 |

## Shared system contract

- Project selection is mandatory and appears directly below the Logly brand.
- Overview, Events, Live, Insights, and Settings always query one project.
- There is no Projects item in desktop or mobile navigation.
- Switching the project updates the URL and every visible metric, event name, route, health value, and project setting.
- Events presents the complete filtered count before the paginated table.
- Event-name ranking and momentum are separate from the row-level event explorer.
- Live is a project-scoped arrival stream, not unrestricted application logging.
- Insights is limited to event, route, source, and visitor-day summaries. Funnels, replay, profiles, and identity joins remain outside scope.

## Reusable implementation map

| Prototype element | Production boundary |
| --- | --- |
| Project switcher | URL-owned project slug plus query invalidation |
| Workspace navigation | Shared sidebar route configuration |
| Range/source/event filters | Typed query-param hooks |
| Event total and ranking | Full-window summary API and database query |
| Event table | Existing copied Midday table core |
| Event detail | Existing global sheet provider and URL identity |
| Charts | shadcn Chart composition with Recharts |
| Settings | Project-scoped forms with generated slug |

## States required during implementation

- New project with no events and an install command.
- No matches for the selected filters, preserving active filter chips.
- Collector unavailable, with no demo-data fallback.
- Invalid or revoked read credential.
- Very long project and event names.
- Mobile table reduction with event detail in the same sheet.
- Project switch loading that never flashes the previous project's values.
