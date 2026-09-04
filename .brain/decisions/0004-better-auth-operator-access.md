# ADR 0004: Better Auth Operator Access

## Status

Accepted.

## Context

Logly's deployed dashboard currently has no operator identity boundary. Project
read keys authenticate machine-to-machine collector reads, but they do not
establish who is allowed to use the portfolio dashboard.

Afterservice already uses Better Auth for email/password sessions. Logly uses
Drizzle rather than Prisma, so the reusable behavior should follow the same
feature while remaining inside Logly's existing database package boundary.

## Decision

- Add a focused `@logly/auth` package using Better Auth's Drizzle adapter and
  the existing `@logly/db` client/schema.
- Keep the dashboard single-operator. Enable email/password sign-in, disable
  public sign-up, and bootstrap the first owner with Better Auth's admin flow.
- Do not require email verification or send auth email in the initial pass.
- Use middleware/proxy cookie checks only for early redirects. Every protected
  dashboard layout must validate the session on the server.
- Keep project read keys for collector API authorization. A dashboard operator
  session does not become a reusable collector credential.
- Fail closed in production when the auth database, auth secret, collector URL,
  or dashboard read credential is unavailable.

## Consequences

- Authentication email is stored only in Better Auth tables and is never copied
  into analytics events, visitor identity, or cross-project profiles.
- The initial short bootstrap password is accepted only because public sign-up
  is disabled; raising the minimum and rotating that credential remain an
  explicit immediate follow-up.
- Password reset, verification, and notification delivery remain unavailable
  until the shared jobs/email/notification stack is implemented.

