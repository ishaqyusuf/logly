# @ishaqyusuf/logly-native

Framework-independent Expo and React Native delivery for Logly. It records one
project-scoped `app_session` per installation-day, deduplicated `screen_view`
events, and explicit bounded events with Android/iOS and app release metadata.

The caller supplies an async storage adapter, UUID creation, platform, app
version, build number, and a same-origin or trusted product proxy endpoint.
No advertising ID, GPS location, email address, or authenticated user ID is
collected.

## Generic identity and groups

Call methods on the analytics client (`useAnalytics()` in Next):

```ts
analytics.identify(projectScopedUserReference);
analytics.group("business", projectScopedTenantReference, { name: "Example shop" });
analytics.setGlobalProperties({ surface: "dashboard" });
analytics.track("order_created", { channel: "pos" });
analytics.clearGroup("business");
analytics.unsetGlobalProperties(["surface"]);
analytics.reset();
```

References must be opaque and project-scoped; do not send raw authenticated IDs
or emails. Names are display metadata, never identity keys. Groups are generic:
at most five types using lowercase snake case (64 characters), each with a key
of at most 128 characters and at most 20 scalar properties (256-character strings).
Invalid `identify`/`group` calls return false and leave valid context unchanged.
Changing the actor clears group and global context; call identify before group.
No profile persistence, historical merge or authentication is implied. The app
must resolve and authorize the active tenant independently.

Events copy context when captured, including queued events. Group changes cannot
relabel earlier events. Explicit event properties override global defaults.
Reset clears actor, groups, defaults and pending events and rotates visitor identity;
it cannot recall an already dispatched network request. Context is memory-only,
so reapply it after reload. Await native reset before tracking a new account.
Public storefront attribution must come from verified server-resolved site context.
Do not use client group claims as a merchant reporting authorization boundary.

Complete serialized events have a 47 KiB UTF-8 budget (batch-envelope headroom).
Oversized captures are rejected before queueing; browser track returns false.
Native reset cancels pending initialization; call init again if reset interrupted
initial startup. Pending persisted visitor/queue writes are ordered before reset.
