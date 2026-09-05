import { describe, it, expect } from "vitest";
import { contrastRatio, readableOn, bestTextOn, composite } from "@/lib/contrast";

/** Real accent colours from the games table — admin-editable, so arbitrary. */
const ACCENTS = { cs2: "#f5a524", lol: "#c9aa71", valorant: "#ff4655", dota: "#dc2626" };
const DARK_GROUND = "#0a0b10";
const LIGHT_GROUND = "#e9ecf6";

describe("contrastRatio", () => {
  it("matches the WCAG anchors", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
  });

  it("is symmetric", () => {
    expect(contrastRatio(ACCENTS.cs2, LIGHT_GROUND)).toBeCloseTo(
      contrastRatio(LIGHT_GROUND, ACCENTS.cs2),
      10,
    );
  });

  it("returns 1 for unparseable input rather than throwing", () => {
    expect(contrastRatio("not a colour", "#ffffff")).toBe(1);
  });
});

/**
 * Measured on the live site with axe-core, 2026-08-30: in light mode ALL FOUR
 * game badges were below the threshold — CS2 at 1.90:1 against a required 4.5.
 * The automated checker never reported it, because axe skips elements sitting
 * on a gradient. Fixing the four colours by hand was not a fix: the admin can
 * add a fifth game in any colour tomorrow. So the colour is computed.
 */
describe("readableOn", () => {
  it("lifts every game accent to the threshold on both grounds", () => {
    for (const [game, colour] of Object.entries(ACCENTS)) {
      for (const ground of [DARK_GROUND, LIGHT_GROUND]) {
        const fixed = readableOn(colour, ground);
        expect(contrastRatio(fixed, ground), `${game} on ${ground}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("leaves a colour alone when it already passes", () => {
    expect(readableOn("#000000", "#ffffff")).toBe("#000000");
  });

  it("honours a custom minimum", () => {
    const fixed = readableOn(ACCENTS.cs2, LIGHT_GROUND, 7);
    expect(contrastRatio(fixed, LIGHT_GROUND)).toBeGreaterThanOrEqual(7);
  });
});

/**
 * The filter pills wrote a FIXED dark text colour on the accent background.
 * That was right for three games and wrong for Dota 2 (#dc2626): dark gives
 * 4.07:1, white gives 4.83:1. A fixed choice is wrong for some game, always.
 */
describe("bestTextOn", () => {
  it("picks white on Dota red and dark on the lighter accents", () => {
    expect(bestTextOn(ACCENTS.dota)).toBe("#ffffff");
    expect(bestTextOn(ACCENTS.cs2)).toBe("#0a0b10");
    expect(bestTextOn(ACCENTS.lol)).toBe("#0a0b10");
  });

  it("always returns the better of the two, whatever the colour", () => {
    for (const colour of Object.values(ACCENTS)) {
      const chosen = bestTextOn(colour);
      const other = chosen === "#ffffff" ? "#0a0b10" : "#ffffff";
      expect(contrastRatio(chosen, colour)).toBeGreaterThanOrEqual(contrastRatio(other, colour));
    }
  });
});

describe("composite", () => {
  it("flattens a translucent colour onto its background", () => {
    expect(composite("#ffffff", 0, "#000000")).toBe("#000000");
    expect(composite("#ffffff", 1, "#000000")).toBe("#ffffff");
  });
});
