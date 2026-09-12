import { expect, test } from "bun:test";
import {
  countryFlag,
  countryHeatOpacity,
  formatVisitCount,
} from "./country-display";

test("country codes render as flag emoji", () => {
  expect(countryFlag("NG")).toBe("🇳🇬");
  expect(countryFlag(" us ")).toBe("🇺🇸");
  expect(countryFlag("unknown")).toBe("🌐");
});

test("heat opacity increases with visit count and caps at full intensity", () => {
  expect(countryHeatOpacity(1, 100)).toBeCloseTo(0.37);
  expect(countryHeatOpacity(25, 100)).toBeCloseTo(0.65);
  expect(countryHeatOpacity(100, 100)).toBe(1);
  expect(countryHeatOpacity(200, 100)).toBe(1);
});

test("visit counts use the correct singular and plural labels", () => {
  expect(formatVisitCount(1)).toBe("1 visit");
  expect(formatVisitCount(2)).toBe("2 visits");
  expect(formatVisitCount(1234)).toBe("1,234 visits");
});
