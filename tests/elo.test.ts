import { describe, it, expect } from "vitest";
import {
  BASE_RATING,
  K_BY_TIER,
  K_NO_TOURNAMENT,
  expectedScore,
  kFactor,
  applyResult,
  replayRatings,
} from "@/lib/elo";

describe("expectedScore", () => {
  it("equal ratings give an even chance", () => {
    expect(expectedScore(1000, 1000)).toBeCloseTo(0.5, 10);
  });

  it("the two sides always sum to one", () => {
    for (const [a, b] of [[1000, 1200], [1500, 900], [1000, 1000]]) {
      expect(expectedScore(a, b) + expectedScore(b, a)).toBeCloseTo(1, 10);
    }
  });

  it("400 points of advantage is roughly ten to one", () => {
    expect(expectedScore(1400, 1000)).toBeCloseTo(10 / 11, 3);
  });
});

describe("kFactor", () => {
  it("scales with tournament tier", () => {
    expect(kFactor("S")).toBe(K_BY_TIER.S);
    expect(kFactor("C")).toBe(K_BY_TIER.C);
    expect(K_BY_TIER.S).toBeGreaterThan(K_BY_TIER.C);
  });

  it("falls back to the middle value outside a tournament", () => {
    expect(kFactor(null)).toBe(K_NO_TOURNAMENT);
    expect(kFactor(undefined)).toBe(K_NO_TOURNAMENT);
  });
});

describe("applyResult", () => {
  it("moves both sides by the same amount in opposite directions", () => {
    const before = { a: 1000, b: 1000 };
    const after = applyResult(before.a, before.b, true, 32);
    expect(after.a - before.a).toBeCloseTo(before.b - after.b, 10);
  });

  it("rewards the upset more than the expected win", () => {
    const upset = applyResult(1000, 1400, true, 32).a - 1000;
    const expected = applyResult(1400, 1000, true, 32).a - 1400;
    expect(upset).toBeGreaterThan(expected);
  });
});

describe("replayRatings", () => {
  const tournament = { tier: "S" as const };

  it("ignores matches with no winner — a fixture is not a result", () => {
    const { rating } = replayRatings([
      { teamAId: "a", teamBId: "b", winnerId: null, tournament },
    ]);
    expect(rating.size).toBe(0);
  });

  /**
   * The reason ratings are replayed from scratch rather than adjusted in place:
   * Elo depends on the order results arrive in, so correcting an old match
   * incrementally would leave every rating after it wrong for good.
   */
  it("depends on order — the same results in a different order differ", () => {
    const first = { teamAId: "a", teamBId: "b", winnerId: "a", tournament };
    const second = { teamAId: "a", teamBId: "c", winnerId: "c", tournament };

    const forward = replayRatings([first, second]).rating.get("a");
    const backward = replayRatings([second, first]).rating.get("a");

    expect(forward).toBeDefined();
    expect(forward).not.toBeCloseTo(backward!, 6);
  });

  it("records the rating held before the most recent match", () => {
    const { rating, previous } = replayRatings([
      { teamAId: "a", teamBId: "b", winnerId: "a", tournament },
    ]);
    expect(previous.get("a")).toBe(BASE_RATING);
    expect(rating.get("a")).toBeGreaterThan(BASE_RATING);
    expect(rating.get("b")).toBeLessThan(BASE_RATING);
  });
});
