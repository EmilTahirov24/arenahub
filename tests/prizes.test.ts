import { describe, it, expect } from "vitest";
import { placeRangeLabel, formatMoney, prizeForPlacement } from "@/lib/prizes";

const row = (placeFrom: number, placeTo: number, amount: number) => ({ placeFrom, placeTo, amount });

describe("placeRangeLabel", () => {
  it("says a single place, not a range of one", () => {
    expect(placeRangeLabel(row(1, 1, 0), "az")).toBe("1-ci yer");
    expect(placeRangeLabel(row(1, 1, 0), "en")).toBe("1st place");
  });

  it("names a real range", () => {
    expect(placeRangeLabel(row(5, 8, 0), "az")).toBe("5-8-ci yerlər");
    expect(placeRangeLabel(row(5, 8, 0), "en")).toBe("5-8th places");
  });

  it("gets the English ordinals right, including the teens", () => {
    expect(placeRangeLabel(row(2, 2, 0), "en")).toBe("2nd place");
    expect(placeRangeLabel(row(3, 3, 0), "en")).toBe("3rd place");
    expect(placeRangeLabel(row(11, 11, 0), "en")).toBe("11th place");
    expect(placeRangeLabel(row(13, 13, 0), "en")).toBe("13th place");
    expect(placeRangeLabel(row(21, 21, 0), "en")).toBe("21st place");
  });
});

describe("formatMoney", () => {
  it("groups thousands with spaces, not commas", () => {
    expect(formatMoney(100000)).toBe("$100 000");
    expect(formatMoney(0)).toBe("$0");
  });
});

/**
 * Prize rows are stored per place RANGE and are ordered by placeFrom, so taking
 * the first match meant a wide range always beat a specific row. Writing
 * "2-4th places $5,000" and then "3rd place $7,000" left the $7,000 invisible
 * on the site — the admin had entered a number that could never be shown.
 * The narrowest matching range wins.
 */
describe("prizeForPlacement", () => {
  const rows = [row(1, 1, 100000), row(2, 4, 5000), row(3, 3, 7000), row(5, 8, 1000)];

  it("prefers the specific place over the range that contains it", () => {
    expect(prizeForPlacement(rows, 3)).toBe(7000);
  });

  it("still uses the range for the places it alone covers", () => {
    expect(prizeForPlacement(rows, 2)).toBe(5000);
    expect(prizeForPlacement(rows, 4)).toBe(5000);
  });

  it("does not depend on the order rows arrive in", () => {
    expect(prizeForPlacement([...rows].reverse(), 3)).toBe(7000);
  });

  it("returns null outside every range and for an unplaced team", () => {
    expect(prizeForPlacement(rows, 9)).toBeNull();
    expect(prizeForPlacement(rows, null)).toBeNull();
    expect(prizeForPlacement([], 1)).toBeNull();
  });
});
