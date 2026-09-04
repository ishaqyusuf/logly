import { describe, expect, test } from "bun:test";
import {
  coerceDatabaseTimestamp,
  decodeEventCursor,
  encodeEventCursor,
  normalizeEventPageSize,
} from "./index";

describe("dashboard database values", () => {
  test("normalizes aggregate timestamps returned as strings", () => {
    expect(
      coerceDatabaseTimestamp("2026-09-01 09:00:00+00")?.toISOString(),
    ).toBe("2026-09-01T09:00:00.000Z");
  });

  test("keeps null and rejects invalid timestamp values", () => {
    expect(coerceDatabaseTimestamp(null)).toBeNull();
    expect(coerceDatabaseTimestamp("not-a-date")).toBeNull();
  });
});

describe("event pagination", () => {
  test("round-trips opaque cursors and rejects invalid offsets", () => {
    expect(decodeEventCursor(encodeEventCursor(75))).toBe(75);
    expect(decodeEventCursor("not-a-cursor")).toBe(0);
    expect(decodeEventCursor()).toBe(0);
  });

  test("keeps page sizes within the dashboard contract", () => {
    expect(normalizeEventPageSize()).toBe(50);
    expect(normalizeEventPageSize(1)).toBe(10);
    expect(normalizeEventPageSize(500)).toBe(100);
  });
});
