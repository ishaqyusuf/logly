# Logo exploration — 2026-09-08

Status: five concept directions delivered; user selection pending.

User requested five logo options with variants and advice on available design skills. No Jetstack capability was found in the installed catalog. Agency Design / Brand Guardian and built-in Imagegen were used; no installation was necessary.

## Deliverables

- Gallery: `.design/brand-options/index.html`.
- Five PNG boards: Signal Notch, Event Thread, Aperture, Event Ledger, Beacon.
- Exact generation prompts: `.design/brand-options/prompts.json`.
- Each board explores a horizontal wordmark, standalone mark, light/dark treatment, app icon and dashboard styling application.
- Recommended shortlist: Signal Notch for continuity with Logly's green identity; Aperture for an editorial direction.

## Review and limits

All five images were visually reviewed. The gallery uses white image backgrounds for correct presentation of PNG transparency. Browser QA confirmed image loading, desktop and 390px layouts without horizontal overflow, and navigation links. Corrected a temporary image-label mismatch and refreshed cached image URLs.

These are raster concept boards, not production vector assets. Some nominal monochrome examples retain accent color, so exact one-color exports and small-size optical adjustments belong in selected-direction refinement. Dashboard data, metrics and marketing copy are illustrative and do not establish product contracts. Keep the selected mark in one canonical asset library and check sidebar, favicon and sign-in consistency before implementation.

## Brain impact

No API, database, architecture or deployed feature contract changed. No production logo was replaced. This task document and `ai/plan.md` record the exploration without making an ADR for an unselected identity.

## Originality screening and revision — 2026-09-09

User requested verification of all five logos and three to five replacement options with a recommendation. Public web/name searches and descriptive image searches found crowded visual motifs, but did not establish copying or exact duplication. No reverse-image upload or comprehensive trademark-register search was completed.

Exact-name LOGLY Audience Analytics and Logly World, plus near-name SolarWinds Loggly, create an unresolved naming concern. A new symbol does not resolve it. Original recommendations are superseded by provisional **A — Offset Register**; B — Cut Paper and C — Paired Imprint are alternatives with documented weaknesses. All three were generated, visually inspected, and saved with exact prompts. None is certified unique or legally cleared.

Full source-linked review, original-five assessments, replacement previews and ranking: `.design/brand-options/revision-2/REVIEW.md`. Production identity remains unchanged. No API/database/architecture/feature contracts changed.

## Selected and implemented — 2026-09-09

User selected A — Offset Register. Reusable vector, live lowercase wordmark, sidebar/mobile header/sign-in integration and generated browser/Apple icons are implemented. Source/usage/validation contract: `.brain/features/brand-identity.md`. Compilation, typecheck, focused lint and public-surface browser QA passed; authenticated sidebar QA is limited by unavailable local Docker. No deployment performed. No API/database contract change; exact icon paths are public in the auth proxy.

Production dashboard build passed, including static generation of both icon routes (2026-09-09).
