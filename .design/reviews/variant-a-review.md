# Variant A review — Signal Desk

Score: **91/100**  
Recommendation: **Choose**

## First impression

I notice a clear product context, a restrained summary strip, and one dominant trend chart. My eye lands in the intended order: project identity, event volume, top events, recent activity. The page behaves like an analytics home rather than a decorated table.

## Strengths

- Best balance of overview and investigation.
- Keeps the thin product scope visible: Overview, Events, Projects, Settings.
- Collection health supports trust without becoming an infrastructure console.
- Summary metrics are one strip, avoiding a dashboard-card mosaic.
- Maps directly to shadcn Sidebar, Chart, ToggleGroup, Badge, Table, Sheet, and Empty patterns.
- Mobile retains the page’s decision order and has no horizontal page overflow at 390px.

## Weaknesses

- The top-event column can feel tight with long custom event names.
- Four summary metrics still need careful skeleton behavior to avoid visual weight when values are zero.
- The Recent Events list should cap at 5–8 rows so the Overview does not become another event explorer.

## Litmus checks

| Check | Result |
| --- | --- |
| Product unmistakable | Yes |
| One strong visual anchor | Yes — event-volume chart |
| Understandable by scanning headings | Yes |
| Each section has one job | Yes |
| Cards necessary | Mostly — they frame distinct interactive tools |
| Motion improves hierarchy | Neutral; only sheet/sidebar state needed |
| Premium without shadows | Yes |

## Required implementation refinements

- Use Recharts/shadcn `ChartContainer`, not the prototype SVG.
- Persist date range in URL state.
- Add accessible text summary for chart values.
- Use the existing URL-addressable event sheet contract.
- Derive collector health from observed signals before showing Healthy.
