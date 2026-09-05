import { describe, it, expect } from "vitest";
import { initials } from "@/lib/initials";
import { playerScore, scoreBarFraction } from "@/lib/playerScore";
import { avatarColor, avatarPaint } from "@/lib/avatarColor";
import { contrastRatio } from "@/lib/contrast";

describe("initials", () => {
  it("takes the first and last word of a multi-word name", () => {
    expect(initials("Natus Vincere")).toBe("NV");
    expect(initials("Ninjas in Pyjamas")).toBe("NP");
  });

  it("takes two letters from a single word", () => {
    expect(initials("Vitality")).toBe("VI");
  });

  it("ignores surrounding and repeated whitespace", () => {
    expect(initials("  Team   Liquid  ")).toBe("TL");
  });
});

/**
 * The headline player number is our own formula, computed from raw per-round
 * facts. An unknown player scores nothing rather than a made-up zero.
 */
describe("playerScore", () => {
  it("returns null when there is nothing to compute from", () => {
    expect(playerScore({ killsPerRound: null, deathsPerRound: null, damagePerRound: null })).toBeNull();
  });

  it("rewards kills and damage, and punishes deaths", () => {
    const base = { killsPerRound: 0.7, deathsPerRound: 0.65, damagePerRound: 78 };
    const moreKills = playerScore({ ...base, killsPerRound: 0.9 })!;
    const moreDeaths = playerScore({ ...base, deathsPerRound: 0.85 })!;
    const moreDamage = playerScore({ ...base, damagePerRound: 95 })!;
    const plain = playerScore(base)!;

    expect(moreKills).toBeGreaterThan(plain);
    expect(moreDamage).toBeGreaterThan(plain);
    expect(moreDeaths).toBeLessThan(plain);
  });

  it("treats a missing component as zero rather than discarding the row", () => {
    expect(playerScore({ killsPerRound: 0.8, deathsPerRound: null, damagePerRound: null })).not.toBeNull();
  });
});

describe("scoreBarFraction", () => {
  it("keeps a sliver visible so a low score is not an empty bar", () => {
    expect(scoreBarFraction(0.01, 2)).toBeGreaterThan(0);
  });

  it("never overflows the bar", () => {
    expect(scoreBarFraction(5, 2)).toBe(1);
  });

  it("survives a zero best score", () => {
    expect(scoreBarFraction(1, 0)).toBe(0);
  });
});

/**
 * Teams without a logo get a coloured badge instead. The colour has to be
 * stable — a team that changes colour between pages looks like a different team.
 */
describe("avatarColor", () => {
  it("is deterministic for a given name", () => {
    expect(avatarColor("Team Vitality")).toBe(avatarColor("Team Vitality"));
  });

  it("gives different names different colours", () => {
    expect(avatarColor("Vitality")).not.toBe(avatarColor("Astralis"));
  });

  it("prefers the team's own colour when it has one", () => {
    expect(avatarColor("Whatever", "#ff0000")).toBe("#ff0000");
  });

  /**
   * The generated badge is a GRADIENT, and an automated contrast checker skips
   * gradients — which is exactly why this project's worst contrast bug went
   * unreported and had to be measured by hand. What can be asserted here is the
   * ink: white on the dark badge, near-black on the light one.
   */
  it("pairs each theme's badge with the right ink", () => {
    const paint = avatarPaint("Vitality");
    expect(paint.inkDark).toBe("#ffffff");
    expect(paint.inkLight).toBe("#14141f");
    expect(paint.dark).toContain("linear-gradient");
    expect(paint.light).toContain("linear-gradient");
  });

  it("computes readable ink against a team's own colour instead of assuming", () => {
    // Dota red is the case that broke a fixed dark ink: it needs white.
    for (const colour of ["#dc2626", "#f5a524", "#c9aa71", "#ff4655"]) {
      const paint = avatarPaint("Any Team", colour);
      expect(contrastRatio(paint.inkLight, colour), colour).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("produces the same gradient for the same name", () => {
    expect(avatarPaint("Astralis").light).toBe(avatarPaint("Astralis").light);
    expect(avatarPaint("Astralis").light).not.toBe(avatarPaint("Heroic").light);
  });
});
