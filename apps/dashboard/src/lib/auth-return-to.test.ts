import { describe, expect, test } from "bun:test";
import { safeReturnTo } from "./auth-return-to";

describe("safeReturnTo", () => {
  test("accepts an internal path", () => {
    expect(safeReturnTo("/projects?range=7d")).toBe("/projects?range=7d");
  });

  test("falls back for external and missing destinations", () => {
    expect(safeReturnTo("https://example.com")).toBe("/events");
    expect(safeReturnTo("//example.com")).toBe("/events");
    expect(safeReturnTo(null)).toBe("/events");
  });
});
