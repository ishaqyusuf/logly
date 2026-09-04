# Product Roadmap

## Now

- Activate idempotent daily rollups, retention cleanup, backups, and truthful
  delivery-health reporting.
- Publish the registry-ready coordinated `0.2.0` SDK release needed for the
  Afterservice pilot.

## Next

- Pilot Afterservice with daily visits and automatically discovered bounded
  domain events; keep application-side typed helpers where they improve DX.
- Integrate a second product with meaningfully different event semantics before
  expanding the shared SDK interface.
- Add CSV export, portfolio health summaries, and per-project north-star event
  counts.

## Later

- Add a daily operator digest.
- Consider a React Native adapter only after a real mobile integration proves
  the need; do not leak browser-storage assumptions into the shared interface.

## Explicitly Out Of Scope

- Session replay, heatmaps, automatic DOM capture, cross-project identity, real-time streaming, and arbitrary analytics query builders.
- Feature-flag delivery, experimentation suites, unrestricted application logs,
  and raw stack-trace ingestion.
