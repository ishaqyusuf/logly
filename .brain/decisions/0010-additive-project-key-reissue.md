# Additive project key reissue

Date: 7 October 2026

## Decision

Recover from lost plaintext by issuing an additional scoped credential for the existing enabled project. Preserve old credentials because independent integrations may still use them. Reuse the existing key table, scope vocabulary and SHA-256 storage. Administration requires the current single-operator admin session and explicit organization/project matching. Never log, cache or persist plaintext in client storage.

## Consequences

No migration, project recreation, implicit revocation or automatic rotation. A failed/lost response can leave an unused active credential. Credential verification matches a supplied hash directly, so newer keys work beyond the previous ten-row lookup. EwaTrade’s existing project-key proxy headers require client-ingest credentials; signed server-write credentials are a different protocol.
