import { describe, expect, test } from "bun:test";
import { createHmac } from "node:crypto";
import {
  isAllowedOrigin,
  normalizeOrigin,
  verifyBatchSignature,
} from "./security";

describe("collector security", () => {
  test("normalizes origins and rejects paths posing as origins", () => {
    expect(normalizeOrigin("https://afterservice.app/path")).toBe(
      "https://afterservice.app",
    );
    expect(normalizeOrigin("not-an-origin")).toBeNull();
  });

  test("matches an origin exactly after normalization", () => {
    expect(
      isAllowedOrigin("https://afterservice.app", [
        "https://afterservice.app/",
      ]),
    ).toBe(true);
    expect(
      isAllowedOrigin("https://evil.afterservice.app", [
        "https://afterservice.app",
      ]),
    ).toBe(false);
    expect(isAllowedOrigin(null, ["https://afterservice.app"])).toBe(false);
  });

  test("verifies a trusted writer signature against the exact request body", () => {
    const body = JSON.stringify({ events: [{ name: "receipt_viewed" }] });
    const key = "logly_sw_test";
    const signature = createHmac("sha256", key).update(body).digest("hex");

    expect(verifyBatchSignature(body, key, signature)).toBe(true);
    expect(verifyBatchSignature(`${body} `, key, signature)).toBe(false);
    expect(verifyBatchSignature(body, key, null)).toBe(false);
  });
});
