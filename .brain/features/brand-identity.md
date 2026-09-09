# Brand identity

## Selected direction

User selected **A — Offset Register** on 2026-09-09 and authorized implementation. The Logly name remains unchanged. The exploratory name/similarity findings in `.design/brand-options/revision-2/REVIEW.md` remain a separate unresolved consideration; selection is not trademark clearance.

## Implementation contract

- `@logly/ui/brand` owns `BrandMark`, `BrandWordmark`, `BrandAppIcon`, `brandMarkPath`, and `brandColor`.
- The 32-unit SVG normalizes the approved concept into two separated rectangular forms with a stepped lower foot and a reversed upper channel. Every placement uses this same geometry.
- Brand green: `#104E32`. Reversed marks are white. UI wordmark: lowercase `logly`, the existing system font stack, weight 750, tracking -0.055em. This is a live-text adaptation of the concept, not an outlined typeface from the raster board.
- Desktop sidebar: 28px white mark in a 40px green tile; expanded sidebar shows the wordmark. Home link retains its project context and accessible name.
- Mobile header: 24px green mark with accessible Logly label.
- Sign-in: 44px green mark with 42px wordmark.
- Next metadata routes `/icon` and `/apple-icon` render 32px and 180px PNGs from the shared component, with 70% mark coverage. Apple applies device-specific corner masking.
- The two exact icon paths are public in the authentication proxy. Other route protection is unchanged.

## Usage

Keep the two pieces and internal gaps intact; no stretching, rotation, strokes, or effects. Use green on light surfaces, white on green/dark surfaces, and black for monochrome uses. Allow at least one-quarter mark width as external clear space where layout permits. BrandMark is decorative by default; give icon-only controls an accessible name and standalone marks a labelled wrapper.

## Validation

UI package compilation, dashboard typecheck, and focused Biome checks passed. Browser QA covered desktop and 390px sign-in, correct metadata links, public 32px favicon and 180px Apple icon rendering, no horizontal sign-in overflow and no console errors. Screenshots: `.design/brand-options/selected/reviews/sign-in-desktop.png` and `sign-in-mobile.png`.

The normal local launcher could not start Docker Engine. Public-surface QA used a loopback dev server with a non-production placeholder database URL and no database interactions. Authenticated dashboard visual QA remains unverified. No deployment was performed.

Production dashboard build passed, including static generation of both icon routes (2026-09-09).
