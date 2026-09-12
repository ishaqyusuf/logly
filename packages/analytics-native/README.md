# @ishaqyusuf/logly-native

Framework-independent Expo and React Native delivery for Logly. It records one
project-scoped `app_session` per installation-day, deduplicated `screen_view`
events, and explicit bounded events with Android/iOS and app release metadata.

The caller supplies an async storage adapter, UUID creation, platform, app
version, build number, and a same-origin or trusted product proxy endpoint.
No advertising ID, GPS location, email address, or authenticated user ID is
collected.
