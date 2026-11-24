# Changelog

## 0.3.0

- Requires `@ishaqyusuf/logly-core` 0.3.0, which records routes as templates
  by default. See its changelog.
- `useAnalytics()` exposes core's `identify`, `group` and `reset`.
- New opt-in `trustCloudflareCountry` route option: when the deployment sits
  behind Cloudflare, the visitor country comes from `cf-ipcountry` instead of
  `x-vercel-ip-country`.
