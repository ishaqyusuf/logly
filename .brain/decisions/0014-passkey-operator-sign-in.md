# ADR 0014: Passkey Operator Sign-in

## Status

Accepted, 2026-11-24. Local and unreleased until the coordinated release.

## Context

The dashboard has one operator signing in with email and password
([ADR 0004](0004-better-auth-operator-access.md)). The operator asked for
passkey sign-in, and agents doing browser QA cannot use the stored password.
Better Auth ships a passkey plugin that persists through the same Drizzle
adapter.

## Decision

- Use `@better-auth/passkey`, pinned to the installed Better Auth version, on
  the server and client. No custom WebAuthn code.
- Passkeys are added only from a signed-in session in Settings. They never
  create users, so public sign-up stays disabled and the password remains the
  recovery path.
- Require discoverable credentials so `/sign-in` can offer a passkey button and
  conditional UI (autofill) without asking for an email first.
- Derive the RP ID from the auth base URL, overridable with `PASSKEY_RP_ID`,
  and pass an explicit list of expected origins filtered to that RP ID instead
  of trusting the request `Origin` header.
- Store credentials in a Better Auth `passkey` table (migration `0009`).

## Consequences

- Passkeys are bound to `logly-chi.vercel.app` in production and
  `logly.localhost` locally. Preview deployments and other hosts need their own
  RP ID and registrations; renaming the production domain orphans passkeys.
- There is no passkey-only account and no passkey reset flow; removing a
  passkey is done from Settings while signed in, or by deleting its row.
- Agents still cannot complete passkey ceremonies; passkey QA needs a human
  with an authenticator.
