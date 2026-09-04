import { describe, expect, test } from "bun:test";
import { isTrustedSameOrigin } from "./request-origin";

describe("same-origin mutation protection", () => {
  test("accepts the external origin reported by a trusted local proxy", () => {
    const request = new Request("http://127.0.0.1:4201/api/projects", {
      headers: {
        origin: "https://logly.localhost",
        "x-forwarded-host": "logly.localhost",
        "x-forwarded-proto": "https",
      },
    });
    expect(isTrustedSameOrigin(request)).toBe(true);
  });

  test("rejects an unrelated origin", () => {
    const request = new Request("https://logly.localhost/api/projects", {
      headers: { origin: "https://attacker.example" },
    });
    expect(isTrustedSameOrigin(request)).toBe(false);
  });
});
