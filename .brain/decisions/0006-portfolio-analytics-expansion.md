# ADR 0006: Authorized portfolio analytics expansion

Status: accepted, 2026-09-07.

The user explicitly requested recommended analytics features and integrations for Halaalvest, Ewatrade, and School Clerk, including separate web/mobile projects. This supersedes ADR 0003's two-integration sequencing restriction for this work.

Implement acquisition reporting from existing fields, ordered same-day conversion funnels, and truthful observed collection health. Keep project-scoped identity, bounded properties, authenticated reads and trusted credential handling. Do not introduce cross-day identity, replay, unrestricted capture, or cross-product joins.

Use organizations to group products and separate projects for web/mobile; these are analytics workspaces, not new operator login accounts. Native credentials must remain on a trusted server proxy. Existing data remains intact. Consumer website acceptance testing awaits the requested follow-up; Logly features require tests and responsive screenshot evidence before deployment.
