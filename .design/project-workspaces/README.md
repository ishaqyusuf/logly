# Logly project workspace exploration

## Locked product model

- A selected project is the workspace context. There is no all-project analytics view.
- The sidebar selector switches the project for every page.
- Projects is not a navigation destination. Project creation and switching live in the selector; project configuration lives in Settings.
- Events are discovered automatically at ingestion. No catalog setup is required.
- Event totals and rankings reflect the complete selected filter window, not the paginated event table.
- Logly remains a thin analytics replacement: no replay, user profiles, funnels, billing, or cross-project identity.

## Connected destinations

Each option includes Overview, Events, Live, Insights, Settings, project switching, time filtering, source filtering, event search, event detail, and responsive navigation.

## Directions

1. **Signal Studio**: balanced, familiar, implementation-friendly. Recommended first build direction.
2. **Event Atlas**: prioritizes event-name ranking and comparison.
3. **Dark Operations**: optimized for live collection monitoring and debugging.
4. **Editorial Ledger**: narrative hierarchy for periodic product review.
5. **Compact Grid**: high information density for daily operators.
6. **Calm Monitor**: spacious and approachable for occasional use.

## Review path

Open `index.html`, then open each full prototype. Start on Events, switch projects, move through all five destinations, and test mobile width. Pick a complete direction or remix named parts, for example: “A navigation + B Events + F visual tone.”

## Implementation mapping

- Shell and selector: `Sidebar`, `ProjectSwitcher`, URL-owned project slug.
- Overview and Insights charts: Recharts fed by full-window summary endpoints.
- Events filters: typed URL search params and the existing Midday-derived filter primitives.
- Events table: existing `components/tables/core` and domain table modules.
- Event detail: URL-addressable global sheet.
- Server data: TanStack Query, with summary and paginated event queries kept separate.
