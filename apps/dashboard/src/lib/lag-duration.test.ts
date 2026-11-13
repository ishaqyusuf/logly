import { describe, expect, test } from "bun:test";
import { formatLagDuration } from "./lag-duration";

describe("formatLagDuration", () => {
  test.each([
    [0, "0.0", "seconds"],
    [1.8, "1.8", "seconds"],
    [1, "1.0", "second"],
    [59.4, "59.4", "seconds"],
    [59.97, "1.0", "minute"],
    [90, "1.5", "minutes"],
    [3_599.9, "1.0", "hour"],
    [29_769, "8.3", "hours"],
    [86_400, "1.0", "day"],
    [302_400, "3.5", "days"],
  ])("%p seconds reads as %s %s", (seconds, value, unit) => {
    expect(formatLagDuration(seconds)).toEqual({ value, unit });
  });

  test("clamps negative and non-finite input to zero", () => {
    expect(formatLagDuration(-4)).toEqual({ value: "0.0", unit: "seconds" });
    expect(formatLagDuration(Number.NaN)).toEqual({
      value: "0.0",
      unit: "seconds",
    });
  });
});
