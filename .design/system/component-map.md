# shadcn implementation map

The prototypes are framework-neutral HTML, but each visual pattern maps to standard shadcn composition. `@logly/ui` remains the product-agnostic wrapper package.

| Prototype pattern | Production composition | Notes |
| --- | --- | --- |
| App shell | `SidebarProvider`, `Sidebar`, `SidebarHeader`, `SidebarContent`, `SidebarFooter`, `SidebarInset`, `SidebarTrigger` | Preserve the existing GND-style organization/project selector while adopting shadcn state and mobile sheet behavior. |
| Breadcrumb header | `Breadcrumb`, `BreadcrumbList`, `BreadcrumbItem`, `BreadcrumbLink`, `BreadcrumbPage`, `Separator` | Organization/project/page orientation. |
| Metric strip | Semantic section + composed `Card` parts only if each metric becomes independently interactive | Do not create a decorative card mosaic. |
| Event chart | `ChartContainer`, `ChartTooltip`, `ChartTooltipContent` + Recharts `AreaChart` | Use `chart-1` and `chart-2` semantic tokens. Include accessible summary text. |
| Date range | `ToggleGroup`, `ToggleGroupItem` | URL-backed single selection. |
| Filter toolbar | `InputGroup`, `InputGroupInput`, `InputGroupAddon`, `Button`, `Popover` or `Sheet` | Mobile filters belong in `Drawer`/`Sheet`; keep labels visible. |
| Event explorer | TanStack Table + shadcn `Table` primitives | Sticky header, stable rows, URL-backed sort/filter/pagination. |
| Event details | `Sheet`, `SheetHeader`, `SheetTitle`, `SheetDescription`, `SheetContent` | Always include `SheetTitle`; route selection via typed query param. |
| Source/status | `Badge` variants | No raw-color status spans. |
| Project portfolio | `Table` for comparison; `Card` only for a single focused project tool | Portfolio answers which project needs attention. |
| API keys | `Table`, `DropdownMenu`, `AlertDialog`, Sonner toast | Secret shown once; revocation is destructive. |
| Loading | `Skeleton` | Match chart, metric, and row geometry. |
| No events/projects | `Empty`, `EmptyHeader`, `EmptyMedia`, `EmptyTitle`, `EmptyDescription`, `EmptyContent` | One specific recovery action. |
| Collector failure | `Alert` for inline degradation; `Empty` for blocked page | Never fall back to demo data in production. |
| Mobile nav | `Sidebar` mobile sheet or product wrapper around shadcn buttons | Four major destinations only. |

## Required additions to `@logly/ui`

Before implementation, add or wrap these standard primitives rather than hand-rolling local variants:

- sidebar
- card
- chart
- tabs/toggle-group
- select/dropdown-menu/popover
- separator
- tooltip
- empty
- alert/alert-dialog
- input-group
- dialog/drawer as needed

Existing button, badge, checkbox, input, sheet, skeleton, and table wrappers should be reused and expanded only through documented variants.

## Composition rules

- Use full `CardHeader`/`CardContent`/`CardFooter` composition.
- Keep menu items inside their group components.
- Keep `TabsTrigger` inside `TabsList`.
- Every `Sheet`, `Drawer`, and `Dialog` has a title.
- Use semantic tokens instead of raw Tailwind colors.
- Use `gap-*`, not `space-x-*` or `space-y-*`.
- Icons come from the configured icon library; icons inside buttons use `data-icon` and inherit sizing.
- URL parameters own range, filters, project context, and selected event.
