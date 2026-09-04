# Dashboard information architecture

Logly remains a thin analytics replacement. The redesign adds clarity, not product breadth.

## Route map

```text
Organization / Project context
├── Overview
│   ├── Event volume
│   ├── Visitors / new / returning / events
│   ├── Top event names
│   ├── Recent events
│   └── Collection health
├── Events
│   ├── URL-backed search, date, source, name, route filters
│   ├── Stable event explorer
│   └── URL-addressable event detail sheet
├── Projects
│   ├── Portfolio health table
│   ├── Connect project
│   └── Project snapshot / open project
└── Settings
    ├── Allowed origins
    ├── API keys
    ├── Collector status
    └── Privacy / retention defaults
```

## Page jobs

### Overview

Question: **What changed, and can I trust the data?**

Primary visual: event-volume trend.  
Secondary evidence: visitor mix, top events, recent events, observed collection health.  
Excluded: arbitrary dashboards, report builder, funnels, cohorts, sessions, profiles, AI analysis.

### Events

Question: **What exactly happened?**

The dedicated table keeps high-density investigation away from the overview. Event names are discovered automatically at ingestion. Clicking a row opens the bounded payload in a sheet; no catalog-management step exists.

### Projects

Question: **Which product needs attention?**

Portfolio mode emphasizes last-event recency, accepted volume, visitor count, rejections, and configuration health. Project selection moves the operator back to project Overview.

### Settings

Question: **Is this project configured safely?**

Settings separates project origins/keys from global collector/privacy defaults. Secrets are never re-rendered after creation.

## Context rules

- Organization and project remain in URL state.
- All Projects is a portfolio scope; one selected project is a product scope.
- Page header breadcrumbs repeat context in text, not just logo/avatar.
- The sidebar contains exactly four major destinations in this phase.
- “Overview” replaces “Activity.”
- “Events” owns the complete table and detailed filtering.

## Mobile priority

1. Page identity and range.
2. Summary metrics.
3. Primary chart.
4. Recent events or project health.
5. Secondary breakdowns.

The mobile event surface shows event name, source, and time. Route, version, identity type, and safe properties live in the detail sheet.

## State matrix

| State | Overview | Events | Projects | Settings |
| --- | --- | --- | --- | --- |
| Loading | Metric/chart/list skeletons | Toolbar + row skeletons | Portfolio row skeletons | Form section skeletons |
| No project | Connect-project empty state | Context redirect | Connect-project empty state | Global settings only |
| No events yet | Install/send-first-event action | Same, with SDK guide | Project marked “waiting” | Origins/keys remain usable |
| Filter no results | Not applicable | Clear-filter action | Clear search | Not applicable |
| Collector failure | Trust-blocking error, retry | Read error, retry | Per-project degraded state | Diagnostic status |
| Unauthorized | Server redirect to sign-in | Same | Same | Same |
