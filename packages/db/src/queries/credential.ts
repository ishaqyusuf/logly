import { createHash, randomBytes } from "node:crypto";

export type ProjectKeyScope =
  | "client-ingest"
  | "server-write"
  | "read"
  | "admin";

const keyPrefixes: Record<ProjectKeyScope, string> = {
  "client-ingest": "logly_ci",
  "server-write": "logly_sw",
  read: "logly_rd",
  admin: "logly_ad",
};

export function createProjectCredential(scope: ProjectKeyScope) {
  return `${keyPrefixes[scope]}_${randomBytes(24).toString("base64url")}`;
}

export function hashCredential(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
