# Operator Authentication

## Status

Implemented and deployed as of 2026-09-01. The intended production Neon
database is configured in Vercel, both reviewed migrations are applied, the
auth runtime is configured, and the guarded single-owner bootstrap completed.
Production health and unauthenticated redirects are verified; authenticated
production browser QA remains part of the Afterservice pilot completion.

## Scope

- Better Auth email/password sessions backed by Postgres through Drizzle.
- One bootstrapped owner/admin account.
- Public sign-up disabled.
- `/sign-in` is public; dashboard routes require a server-validated session.
- Sign-out is available from the dashboard shell.
- Email verification, password-reset delivery, welcome email, and notification
  preferences are deliberately absent in the first pass.

## Security Contract

- `BETTER_AUTH_SECRET` is required at runtime in production.
- `BETTER_AUTH_URL` and trusted origins must match the deployed dashboard.
- Auth cookies are HTTP-only and managed by Better Auth.
- Proxy checks improve navigation only; server-side layout validation is the
  authorization boundary.
- The auth email and user ID never enter analytics payloads.
- Production dashboard data never falls back to demo data after authentication.

## Bootstrap

The owner account is created with `bun --filter @logly/auth bootstrap:owner`
only after confirming `DATABASE_URL` points to the intended Logly database and
the auth migration is applied. The credential is supplied through temporary
environment variables and must not be committed, printed, or added to Brain.
The bootstrap refuses to continue if a different user exists or if it detects a
partial owner without a credential account.

Local QA used an isolated disposable Postgres database and disposable owner.
It verified protected-route redirect, sign-in, authenticated dashboard access,
sign-out, responsive layouts, and a clean browser console. Production bootstrap
used temporary deployment variables that were removed immediately afterward;
the successful runtime deployment does not contain an owner password variable.
No plaintext credential is stored in the checkout or Brain.

## Deferred Notification System

Implement the full Afterservice-style system as a separate project slice:

- `@logly/notifications` templates/contracts;
- `@logly/jobs` Trigger.dev tasks and schedules;
- Resend provider delivery and environment routing;
- verification, password reset, welcome, security, and digest email flows;
- in-app notification storage, preferences, delivery logs, retries, and
  dead-letter/operational visibility;
- development/preview safe routing and production canaries.

## Public brand assets — 2026-09-09

The exact `/icon` and `/apple-icon` paths are public so generated brand images load before sign-in. Dashboard session enforcement is unchanged. See `brand-identity.md`.

## Passkey sign-in — 2026-11-24 (local, unreleased)

See [ADR 0014](../decisions/0014-passkey-operator-sign-in.md).

- Better Auth's passkey plugin (`@better-auth/passkey` 1.7.2) runs on the
  server (`packages/auth`) and the dashboard client (`lib/auth-client.ts`).
  Email/password sign-in is unchanged and stays the recovery path.
- Registration requires a signed-in session (plugin default), so passkeys never
  create accounts and public sign-up stays disabled. Settings → **Passkeys**
  lists, adds (with an editable device name) and removes the operator's own
  passkeys; it renders on the project and empty-project Settings views.
- `/sign-in` keeps the password form and adds **Sign in with a passkey**. Where
  the browser supports conditional mediation, saved passkeys also appear in the
  email field's autofill (`autocomplete="username webauthn"`); clicking the
  button aborts the pending autofill request. Cancelled prompts show a short
  message; autofill cancellations stay silent.
- Credentials are discoverable (`residentKey: required`) so sign-in needs no
  email first; user verification is `preferred`.

### Relying party configuration

| Variable | Default | Purpose |
|---|---|---|
| `PASSKEY_RP_ID` | hostname of the auth base URL (`BETTER_AUTH_URL`, then `NEXT_PUBLIC_DASHBOARD_URL`, then `VERCEL_URL`) | WebAuthn RP ID. Locally `logly.localhost`; production `logly-chi.vercel.app`. |
| `PASSKEY_RP_NAME` | `Logly` | Name shown in the authenticator prompt. |
| `PASSKEY_ORIGINS` | — | Extra comma-separated expected origins. |

Expected origins are the base URL, `BETTER_AUTH_TRUSTED_ORIGINS` and
`PASSKEY_ORIGINS`, filtered to hosts equal to or under the RP ID, so the plugin
never falls back to trusting the request's `Origin` header. Production needs no
new variable while `BETTER_AUTH_URL` is `https://logly-chi.vercel.app`.
Passkeys are bound to the RP ID: they do not work on Vercel preview URLs or on
`http://localhost:4201` unless the RP ID is set to match (for example
`PASSKEY_RP_ID=localhost`), and changing the RP ID orphans existing passkeys.

### Verification

Unit tests cover RP resolution and passkey error mapping. Browser QA on
`https://logly.localhost/sign-in` confirmed the button, the autofill hint, the
authentication-options request (RP ID `logly.localhost`) and a clean console.
Registering and using a real passkey, and the Settings list, need the operator
to sign in with an authenticator; that QA is pending with the user, and the
local database needs migration `0009_passkeys` first.
