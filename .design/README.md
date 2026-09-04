# Logly dashboard redesign package

The current exploration is [project-workspaces/index.html](project-workspaces/index.html).
It compares six connected, project-scoped dashboard directions. Each direction
contains Overview, Events, Live, Insights, and Settings, with project switching
inside the sidebar rather than a Projects navigation page.

The earlier Signal Desk review remains in [index.html](index.html) as historical
context. Its portfolio-oriented Projects page is superseded by the current
project-workspace brief.

## Recommendation

**Signal Studio** is the recommended implementation base. **Event Atlas** is the
strongest alternative when event-name comparison should dominate the product.

Read [project-workspaces/design-review.md](project-workspaces/design-review.md)
for the new scorecard, shared interaction contract, reusable production mapping,
and required states.

Read [recommendation.md](recommendation.md) for the rationale and implementation sequence.

## Interactive concepts

- [Variant A — Signal Desk](concepts/variant-a-signal-desk.html)
- [Variant B — Editorial Pulse](concepts/variant-b-editorial-pulse.html)
- [Variant C — Control Room](concepts/variant-c-control-room.html)

## Recommended page suite

- [Overview](recommended/overview.html)
- [Events](recommended/events.html)
- [Projects](recommended/projects.html)
- [Settings](recommended/settings.html)
- [Loading, empty, error, and responsive states](recommended/states.html)

## Guides and reviews

- [Current-state audit](research/current-state-audit.md)
- [Reference shortlist](research/reference-shortlist.md)
- [Information architecture](information-architecture.md)
- [Design system](system/design-system.md)
- [shadcn component map](system/component-map.md)
- [Variant A review](reviews/variant-a-review.md)
- [Variant B review](reviews/variant-b-review.md)
- [Variant C review](reviews/variant-c-review.md)

## Source evidence

- [Current Logly desktop](research/screenshots/logly-current.png)
- [Current Logly mobile](research/screenshots/logly-current-mobile.png)
- [Current Projects](research/screenshots/logly-projects-current.png)
- [Current Settings](research/screenshots/logly-settings-current.png)
- [OpenPanel reference](research/screenshots/openpanel-reference.png)

## Prototype notes

- The HTML uses the vendored gstack Pretext engine for text measurement/reflow.
- The prototypes use semantic CSS tokens aligned to shadcn theming.
- Production charts should use shadcn Chart + Recharts; prototype SVGs are visual references only.
- Search and event-detail sheet interactions work in the recommended Events prototype.
- Google Fonts are used for preview typography; Manrope and IBM Plex Mono should be loaded through `next/font` during implementation.
- No production dashboard source was changed.
