# Logly dashboard current-state audit

Date: 2026-09-02  
Target: `https://logly.localhost`  
Classifier: app UI  
Evidence: authenticated local dashboard and authenticated OpenPanel reference inspected in Chrome.

## First impression

The dashboard communicates a careful, privacy-minded operational product, but the Activity page still behaves like an event table with summary decoration rather than an analytics home.

I notice a polished warm-neutral shell and a clear project selector. My eye then goes to four large zero-value summaries, the filter row, and the event table. The one thing an operator most needs—how usage changed over time—has no visual anchor.

One-word verdict: **under-instrumented**.

The present shell passes most of the trunk test: product, current section, primary navigation, context selector, and search are visible. It does not clearly distinguish portfolio overview from project overview, and “Activity” combines two different jobs: monitoring aggregate health and investigating individual events.

## Baseline scores

| Category | Grade | Evidence |
| --- | --- | --- |
| Visual hierarchy | C | Four equal summary quadrants dominate; no chart or explicit primary question. |
| Typography | C | Rendered `h1` is 15px; body relies on system/Inter stacks and the page title is visually understated. |
| Spacing and layout | B | Calm 8px-like rhythm, but the hover-expanded sidebar can cover the left page edge. |
| Color and contrast | B | Coherent warm neutral and green system; status semantics need observed health data. |
| Interaction states | B- | Filters and event sheet exist, but several interactive rows/controls render under 44px. |
| Responsive | D | Mobile keeps the wide event table; columns clip instead of becoming a task-focused event list. |
| Content quality | B | Utility copy is concise; “Activity” is too broad for the page’s mixed jobs. |
| AI slop | B | Avoids gradients and decorative icon cards, though the four-up summary block is overly template-like. |
| Motion | B | Sidebar transition is restrained; no unnecessary motion observed. |
| Performance feel | B | Local pages render quickly and the main shell stays stable. |

Overall design score: **C+**  
AI-slop score: **B**

## High-impact findings

### F-01 — No analytical home

I notice that an operator must infer trend and composition from a table. Add a dedicated Overview route with one dominant event-volume chart, summary metrics, top event names, recent events, and collection health. Keep the full table on Events.

Evidence: [current desktop](/Users/M1PRO/Documents/code/logly/.design/research/screenshots/logly-current.png)

### F-02 — Mobile preserves desktop table semantics

The mobile view clips secondary columns and makes individual events hard to inspect. Replace the mobile table with a two-column task view: event identity plus source/time; open the existing detail sheet for the rest.

Evidence: [current mobile](/Users/M1PRO/Documents/code/logly/.design/research/screenshots/logly-current-mobile.png)

### F-03 — Page hierarchy understates location

The rendered H1 is 15px and visually competes with toolbar/status text. Use a 24–34px page title, a small context eyebrow, and breadcrumbs that identify organization, project, and page.

### F-04 — Portfolio and project scopes blur together

The current route can show all projects or one project, but the information hierarchy barely changes. Portfolio overview should answer “which project needs attention?”; project overview should answer “what changed in this product?”

### F-05 — Collection health needs evidence

“Collector healthy” is useful only when it is tied to observed signals: last accepted event, delivery rate, rejected batches, and configured origin/signature/read boundaries. Avoid a green label backed only by process availability.

### F-06 — Hover expansion can cover orientation content

The GND-style rail is appropriate, but its expanded state overlays the left edge of Projects at the tested desktop width. Preserve the 84px shell offset, keep page headings outside the expansion region, and make the overlay state visually obvious.

Evidence: [current Projects page](/Users/M1PRO/Documents/code/logly/.design/research/screenshots/logly-projects-current.png)

## Existing strengths to retain

- Warm-neutral surfaces with one restrained green accent.
- Persistent organization/project context.
- URL-addressable navigation and event details.
- Monospace treatment for event names and technical identifiers.
- Privacy language and project-isolated identity model.
- Simple Projects and Settings surfaces without product-suite sprawl.

## Quick wins

1. Rename Activity to Overview and move the full table to Events.
2. Put a seven-day event-volume chart immediately after the page heading.
3. Increase page title hierarchy and add organization/project breadcrumbs.
4. Convert mobile event rows into a compact list with a details sheet.
5. Replace generic collector health with four observed signals.

## Goodwill walkthrough

Goodwill starts at 70/100.

- Context is preserved and visible: +5.
- Page loads quickly with real local data: +5.
- Operator must scan a large table to answer “what changed?”: -10.
- Mobile table clips the investigative context: -10.
- Project and settings routes remain easy to find: +5.

Final: **65/100 — healthy foundation, clear analytics debt.**
