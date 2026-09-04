# Coding Standards

## Midday Standard

- Keep route entrypoints compositional.
- Tables use `components/tables/core` and `components/tables/<domain>/{columns,data-table,table-header,skeleton,empty-states,bottom-bar}.tsx`.
- Global sheets use `components/sheets/global-sheets.tsx` and `global-sheets-provider.tsx`.
- URL-addressable filters and sheets use typed query-param hooks.
- Reusable schemas and behavior live in packages with explicit exports.

<!-- personal-coding-rules:start -->
## Global Personal Coding Rules

Agents must treat these global coding rule references as non-negotiable:

- `/Users/M1PRO/.me/coding-standards/global.md`
- `/Users/M1PRO/.me/coding-standards/nextjs.md`

Project-specific exceptions require an ADR in `.brain/decisions/` before agents may diverge.
<!-- personal-coding-rules:end -->
