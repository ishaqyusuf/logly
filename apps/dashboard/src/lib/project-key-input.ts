import type { IssueProjectKeyInput } from "@logly/db/queries";

const slugPattern = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const scopes = new Set(["client-ingest", "server-write", "read", "admin"]);

export function parseProjectKeyInput(
  value: unknown,
): IssueProjectKeyInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (
    typeof input.organization !== "string" ||
    !slugPattern.test(input.organization) ||
    typeof input.project !== "string" ||
    !slugPattern.test(input.project) ||
    typeof input.scope !== "string" ||
    !scopes.has(input.scope)
  )
    return null;
  return {
    organization: input.organization,
    project: input.project,
    scope: input.scope as IssueProjectKeyInput["scope"],
  };
}
