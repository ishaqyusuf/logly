# Changelog

## 0.3.0

First published release.

- **Behavior change:** routes are recorded as templates by default
  (`/orders/04512AB/edit?tab=1` becomes `/orders/:id/edit`) before events are
  queued, so record IDs and tokens never leave the device. Add project rules
  with `routeTemplates: { redactPrefixes, idParents, keep, maxSegments }`, or
  pass `routeTemplates: false` to keep raw pathnames. Page views are still
  deduplicated on the real path. Upgrading changes the routes existing
  projects record.
- Generic identity and groups: `identify`, `group` and global context are
  snapshotted onto each event when it is captured, including queued events.
  References must be opaque and project-scoped. Invalid calls return `false`
  and leave valid context unchanged. Changing the actor clears group context.
- `reset` clears the actor, groups, defaults and pending events, and rotates
  the visitor identity.
- Serialized events have a 47 KiB budget; oversized captures are rejected
  before they are queued.
- Native `reset` cancels a pending initialization; call `init` again afterwards.
