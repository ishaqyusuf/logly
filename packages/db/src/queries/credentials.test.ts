import { describe, expect, test } from "bun:test";
import { createProjectCredential, hashCredential } from "./index";

describe("project credentials", () => {
  test("creates distinct scoped credentials and stores stable hashes", () => {
    const clientKey = createProjectCredential("client-ingest");
    const serverKey = createProjectCredential("server-write");

    expect(clientKey).toMatch(/^logly_ci_[A-Za-z0-9_-]{32}$/);
    expect(serverKey).toMatch(/^logly_sw_[A-Za-z0-9_-]{32}$/);
    expect(clientKey).not.toBe(serverKey);
    expect(hashCredential(clientKey)).toHaveLength(64);
    expect(hashCredential(clientKey)).not.toContain(clientKey);
  });
});
