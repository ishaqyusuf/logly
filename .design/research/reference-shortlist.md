# Dashboard reference shortlist

The references are used for interaction and information-architecture patterns only. No OpenPanel, Plausible, or PostHog source/assets are copied.

## Candidate pool

| Candidate | Type | Disposition |
| --- | --- | --- |
| shadcn dashboard-01 | Open-source block | Reuse composition pattern |
| shadcn sidebar-07 | Open-source block | Reuse collapsible shell pattern |
| shadcn chart gallery | Open-source component examples | Reuse chart wrapper semantics |
| Recharts | MIT chart library | Recommended production chart primitive |
| TanStack Table | MIT headless table | Retain for Events explorer |
| Tremor OSS dashboard | Apache-2.0 template | Reference dense analytics rhythm |
| Apache ECharts | Apache-2.0 chart library | Viable alternative, not preferred here |
| Umami | MIT analytics product | Reference restraint and overview density |
| Plausible live dashboard | Product reference | Reference one-page filtering and real-time scan |
| PostHog product analytics | Product reference | Reference insight-to-event drill-down |
| OpenPanel | Product reference | Reference project-first navigation only |
| Vercel Web Analytics | Product reference | Reference chart restraint |
| Axiom | Product reference | Reference event stream density |
| Grafana | Open-source product | Too infrastructure-heavy for Logly MVP |
| Metabase | Open-source product | Too report-builder oriented |
| Apache Superset | Open-source product | Too broad and dashboard-builder heavy |
| Lightdash | Open-source product | Too semantic-layer oriented |
| OpenStatus | AGPL product | Reference operational health status only |
| Tinybird | Product reference | Reference endpoint/ingest visibility |
| Sentry Insights | Product reference | Reference issue-to-detail navigation only |

## Verified reusable resources

1. [shadcn dashboard blocks](https://ui.shadcn.com/blocks?category=dashboard) — open-source dashboard shell with sidebar, section metrics, chart, and data table. Use the composition and responsive model; adapt tokens and content to Logly.
2. [shadcn sidebar](https://ui.shadcn.com/docs/components/base/sidebar) — documented `SidebarProvider → Sidebar → SidebarInset` structure with groups, menu items, footer, rail, mobile sheet, and active states.
3. [Recharts](https://github.com/recharts/recharts) — MIT-licensed React chart library and the implementation beneath shadcn charts. Best fit for Logly’s Next.js/shadcn stack.
4. [TanStack Table](https://github.com/tanstack/table) — MIT-licensed headless table with filtering, sorting, grouping, selection, and server-side control. Best fit for the dedicated Events explorer.
5. [Tremor OSS dashboard template](https://github.com/tremorlabs/template-dashboard-oss/blob/main/README.md) — Apache-2.0 analytics template. Useful for density and chart/table proportion, not as a visual identity.
6. [Apache ECharts](https://github.com/apache/echarts) — Apache-2.0 visualization library. More capable than required for this thin MVP; keep as a future option, not an initial dependency.
7. [Umami](https://github.com/umami-software/umami) — MIT-licensed privacy-first analytics product. Useful proof that a restrained single-page overview can remain understandable.

The shadcn repository is [MIT licensed](https://github.com/shadcn-ui/ui/blob/main/LICENSE.md). The project currently has no `components.json`, so the implementation guide treats `@logly/ui` as the local wrapper layer and maps missing primitives explicitly rather than installing a second UI system.

## Audited live/product references

### OpenPanel

The authenticated After Service tab was inspected in Chrome. Its subscription-ended state blocked the dashboard content, but its project-first navigation was visible: Overview, Dashboards, Insights, Pages, Realtime, Events, Sessions, Profiles, Groups, Cohorts, and management pages. Logly should borrow only the orientation pattern—not that breadth. The thin Logly scope needs Overview, Events, Projects, and Settings.

Evidence: [OpenPanel screenshot](/Users/M1PRO/Documents/code/logly/.design/research/screenshots/openpanel-reference.png)

### Plausible

[Plausible’s real-time dashboard](https://plausible.io/docs/realtime-dashboard) keeps the current visitor count, traffic chart, top sources/pages, and goals on one filterable screen. The useful Logly pattern is not “one page for everything,” but “one dominant time-series plus directly related breakdowns.”

### PostHog

[PostHog’s product analytics surface](https://github.com/PostHog/posthog.com/blob/master/contents/docs/product-analytics/surfaces/web-app.mdx) links insights, dashboards, filters, and event/person drill-down. Logly should keep the drill-down loop while excluding funnels, retention builders, SQL, AI analysis, session replay, and broad report construction until real pilot needs justify them.

## Chosen synthesis

- shadcn supplies the shell, tokens, component composition, and responsive primitives.
- Recharts supplies the production chart implementation.
- TanStack Table remains confined to the Events explorer.
- Plausible contributes scanable overview behavior.
- PostHog contributes clear drill-down from trend to event.
- OpenPanel contributes project-first orientation but not product breadth.
