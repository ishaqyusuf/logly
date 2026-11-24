# 0015. Deploy markers through a signed, idempotent release endpoint

Accepted 2026-11-24.

Products need to tell Logly when they deploy so charts can show releases.
Options were a new release-scoped credential, reusing event ingest (a
`release` event), or a dedicated endpoint on the existing trusted-writer
model.

Decision: a dedicated `POST /v1/releases` authenticated exactly like trusted
server ingest (`server-write` project key bearer plus HMAC of the raw body),
stored in its own `analytics_releases` table with a unique
`(project_id, environment, version)` index. Repeats are a no-op that returns
the stored row.

Why:

- Releases are operational metadata, not visitor events: they must not count
  toward event totals, alerts or funnels, and need upsert-style identity.
- Reusing the server-write key means no new credential type or key issuance
  flow; products that already send server events have the key.
- First-write-wins idempotency makes CI retries and repeated `postbuild` runs
  safe, and a retry can never move a marker.

Consequences:

- Vercel deploy hooks cannot be used (they only trigger builds). Products call
  `logly-release` from `postbuild` or a CI step; the SDK CLI hides signing.
- curl users must compute the HMAC (`openssl dgst -sha256 -hmac`).
- Editing a release means delete and re-add (dashboard admins only).
- Manual dashboard markers are written in-process through `@logly/db`, like
  project-key issuance; reads go through the collector REST API.
