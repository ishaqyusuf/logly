# Logly dashboard design system

Status: recommended for review, not yet an implementation contract.

## Design character

Logly is a calm operational instrument: precise, private, and immediately useful. It should feel closer to a compact signal desk than a business-intelligence builder.

Principles:

1. One question per page.
2. One dominant visual anchor per overview.
3. Tables are for investigation, not for first impressions.
4. Color reports status and comparison; it does not decorate.
5. Project context is always visible.
6. Privacy boundaries are expressed through omissions as much as copy.

## Foundation tokens

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--background` | `#f7f7f3` | `#171a18` | App canvas |
| `--foreground` | `#1a1d1b` | `#e8ece8` | Primary text |
| `--card` | `#fbfbf8` | `#1c201d` | Focused surfaces |
| `--muted` | `#eff0ea` | `#272c28` | Quiet fills and hover |
| `--muted-foreground` | `#656c67` | `#a1aaa3` | Secondary text |
| `--primary` | `#1f6b4f` | `#78be96` | Constructive action and accepted signal |
| `--destructive` | `#b33a32` | `#ed7469` | Rejection/error/destructive action |
| `--warning` | `#a86118` | `#dfa957` | Degraded or attention-needed status |
| `--border` | `#d9ddd5` | `#343a35` | Dividers and control borders |
| `--ring` | `#2d795d` | `#80c69d` | Focus visibility |

Chart palette:

- Event volume: `--chart-1` / primary green.
- Visitor comparison: `--chart-2` / lighter green-gray.
- Warnings: `--chart-3` / amber.
- Neutral comparison: `--chart-4` / slate.
- Rejection/error only: `--chart-5` / muted red.

Never encode a series or state by color alone; pair it with a visible legend, label, icon shape, or line pattern.

## Typography

- UI and display: Manrope, 400/500/600/700.
- Technical values: IBM Plex Mono, 400/500.
- Page title: 24–34px, 1.1 line-height, `-0.045em` tracking.
- Section title: 14–18px, 700.
- Body: 15–16px, 1.5 line-height.
- Dense table: 12–13px only when backed by stable columns and sufficient row height.
- Labels/captions: 11–12px, high enough contrast to remain legible.

Use the monospace face only for event names, hashes, slugs, timestamps, and numeric metrics. Human-facing labels stay in Manrope.

## Spacing and shape

- Spacing scale: 4, 8, 12, 16, 20, 24, 32px.
- Main content gutter: 28px desktop, 20px tablet, 16px mobile.
- Control height: 40px desktop, minimum 44px touch target on mobile.
- Table row: 54px desktop; 62px mobile event list.
- Radius: 6px compact controls, 9px repeated UI, 12px only for primary panels/sheets.
- Elevation: borders first. Shadow only for overlays and sheets.

## Layout

Desktop shell:

- 248px stable sidebar at wide widths.
- 84px icon rail at 701–1024px.
- Bottom navigation below 701px.
- Sticky 64px page header with breadcrumbs and contextual actions.
- Maximum content width 1480px.

Overview composition:

- Page heading and range controls.
- Four-metric strip, not four detached cards.
- Main grid: 1.8fr chart/stream to 0.8fr top-events/health.
- Recent events remain a bounded list; full investigation moves to Events.

## Component states

Every reusable component must define default, hover, active, focus-visible, disabled, loading, empty, error, and reduced-motion behavior where applicable.

- Loading uses `Skeleton` geometry that matches final content.
- Empty states use shadcn `Empty` with a specific next action.
- Errors use `Alert` or an `Empty`-style blocking state with retry and settings paths.
- Event details use a URL-addressable `Sheet`; mobile may use `Drawer` if the existing route contract is preserved.
- Destructive key revocation uses `AlertDialog`.
- Toast feedback uses Sonner.

See [system states](../recommended/states.html).

## Accessibility contract

- WCAG AA contrast for body text and controls.
- Visible `focus-visible` ring using `--ring`.
- Minimum 44px mobile targets.
- Real labels for every input; placeholders never stand in for labels.
- Charts have accessible names and a tabular/text summary.
- Sheets/dialogs always have a programmatic title.
- Mobile layout has no horizontal page scroll at 375px.
- `prefers-reduced-motion` removes nonessential transitions.

## Privacy contract

Never visualize or expose email addresses, raw authenticated user IDs, form values, unrestricted log bodies, raw stack traces, secrets, or cross-project identity. “Visitor” always means a project-scoped derived identity.
