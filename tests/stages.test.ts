import { describe, it, expect } from "vitest";
import {
  normaliseStage,
  describeStage,
  stageName,
  stageRoundName,
  isBracketStage,
  STAGE_SUGGESTIONS,
} from "@/lib/stages";

/**
 * The vocabulary is CLOSED on purpose. A round the site cannot recognise is
 * left out of the bracket rather than guessed, because a guessed round is an
 * invented claim about a real team.
 */
describe("normaliseStage", () => {
  it("canonicalises the many ways a round is written", () => {
    expect(normaliseStage("  final  ")).toBe("Final");
    expect(normaliseStage("GRAND FINAL")).toBe("Grand Final");
    expect(normaliseStage("semi-final")).toBe("Semifinal");
    expect(normaliseStage("Semifinals")).toBe("Semifinal");
    expect(normaliseStage("Quarterfinals")).toBe("Quarterfinal");
  });

  it("understands both halves of a double-elimination bracket", () => {
    expect(normaliseStage("UB Final")).toBe("Upper Bracket Final");
    expect(normaliseStage("losers final")).toBe("Lower Bracket Final");
  });

  it("returns null for anything it does not recognise", () => {
    for (const unknown of ["", "Showmatch", "Çeyrək final", "random text", null, undefined]) {
      expect(normaliseStage(unknown)).toBeNull();
    }
  });

  it("is idempotent — every suggestion normalises to itself", () => {
    for (const stage of STAGE_SUGGESTIONS) {
      expect(normaliseStage(stage), stage).toBe(stage);
    }
  });
});

describe("isBracketStage", () => {
  it("separates bracket rounds from everything else", () => {
    expect(isBracketStage("Quarterfinal")).toBe(true);
    expect(isBracketStage("Grand Final")).toBe(true);
    expect(isBracketStage("Group Stage")).toBe(false);
    expect(isBracketStage(null)).toBe(false);
  });
});

describe("describeStage", () => {
  it("reports which lane a round sits in", () => {
    // The upper bracket is the MAIN lane: it is the ordinary progression, and
    // the lower bracket is the second chance hanging off it.
    expect(describeStage("Upper Bracket Final")).toMatchObject({ kind: "bracket", lane: "main" });
    expect(describeStage("Lower Bracket Semifinal")).toMatchObject({ kind: "bracket", lane: "lower" });
  });

  it("orders rounds so the bracket can be drawn left to right", () => {
    const quarter = describeStage("Quarterfinal")!.step;
    const semi = describeStage("Semifinal")!.step;
    const final = describeStage("Final")!.step;
    expect(quarter).toBeLessThan(semi);
    expect(semi).toBeLessThan(final);
  });
});

/**
 * Azerbaijani ordinals follow vowel harmony: the suffix is chosen by the last
 * vowel of the number's name, so 1 takes -ci, 3 takes -cü and 6 takes -cı.
 * A single hard-coded suffix would be wrong for most rounds.
 */
describe("Azerbaijani round names", () => {
  it("applies vowel harmony to round numbers", () => {
    expect(stageRoundName("Upper Bracket Round 1", "az")).toBe("1-ci raund");
    expect(stageRoundName("Lower Bracket Round 2", "az")).toBe("2-ci raund");
  });

  it("names the bracket half as well as the round", () => {
    expect(stageName("Upper Bracket Round 1", "az")).toBe("Yuxarı bracket — 1-ci raund");
    expect(stageName("Lower Bracket Round 2", "az")).toBe("Aşağı bracket — 2-ci raund");
  });

  it("uses the fraction form for early rounds", () => {
    expect(stageName("Round of 32", "az")).toBe("1/16 final");
  });

  it("translates the finals", () => {
    expect(stageName("Grand Final", "az")).toBe("Böyük final");
    expect(stageName("Third Place Match", "az")).toBe("3-cü yer uğrunda");
  });
});
