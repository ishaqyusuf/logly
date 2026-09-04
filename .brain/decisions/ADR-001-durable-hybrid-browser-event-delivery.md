# ADR: Durable Hybrid Browser Event Delivery

## Status

Accepted

## Context

The browser SDK previously kept pending events only in memory and treated a
queued Beacon or any resolved fetch as successful. Reloads, offline exits, and
non-2xx collector responses could therefore lose events. Sending each event
immediately would increase network and database activity, while cookies or a
large local-storage journal would add request overhead or synchronous browser
work.

## Decision

Keep the project-scoped visitor record in local storage and persist pending
events in a bounded IndexedDB queue. Send a visitor's first-ever `site_visit`
immediately, then flush later events in batches after 60 seconds, at 25 events,
at 48 KiB of queued payload, on lifecycle changes, or when connectivity returns.
Claim queued events transactionally across tabs, acknowledge them only after a
2xx collector response, and retain stable event IDs for idempotent retry.

Treat `site_visit` and `page_view` as reserved system events. Pageviews and
declarative `data-logly-event` click tracking remain opt-in. Routes contain only
the pathname, and declarative events include only `data-logly-prop-*` values.

## Alternatives

- Cookies were rejected because they are sent with unrelated HTTP requests.
- A local-storage event journal was rejected because serialized reads and
  writes are synchronous and multi-tab coordination is weak.
- Zustand persistence was rejected because the framework-independent SDK must
  not depend on React state management.
- A memory-only queue was retained only as the fallback when IndexedDB is
  unavailable.

## Consequences

- Routine browser traffic uses fewer collector requests and one existing
  multi-row database insert per batch.
- Offline events can survive reloads for up to 24 hours, bounded to 250 events
  per project.
- Delivery can be delayed by up to 60 seconds after the first-ever visit.
- IndexedDB and lifecycle behavior add browser-specific implementation and test
  complexity.

## Implementation Notes

- `analytics-core` owns queue persistence, claims, delivery, and privacy
  filtering.
- `analytics-next` observes Next.js pathname changes only when enabled.
- Apps opt into pageviews and declarative clicks; the collector continues to
  validate custom events against the project catalog.
- No database schema or endpoint migration is required.
