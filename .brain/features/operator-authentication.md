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
