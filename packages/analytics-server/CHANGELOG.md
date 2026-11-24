# Changelog

## 0.4.0 (unreleased)

- Deploy markers: `createServerAnalytics(...).release({ version, environment,
  deployedAt, description, url })` and the standalone `sendRelease` record a
  release with the signed `POST /v1/releases` endpoint. Repeating a version is
  a no-op.
- `logly-release` CLI for CI and `postbuild` scripts. It reads
  `LOGLY_COLLECTOR_URL`, `LOGLY_PROJECT`, `LOGLY_SERVER_KEY` and derives the
  release from Vercel or GitHub Actions variables (or `LOGLY_RELEASE_*`). It
  never fails the build unless run with `--strict`.
- `releaseFromEnvironment(env)` exposes that derivation.

## 0.3.0

- Requires `@ishaqyusuf/logly-core` 0.3.0.
- Server events accept a `groups` option with opaque, project-scoped group
  references, stored alongside the event.
