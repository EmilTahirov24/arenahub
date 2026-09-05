import { describe, it, expect } from "vitest";
import { orgKey, indexByOrg } from "@/lib/orgNames";

describe("orgKey", () => {
  it("strips the decorative words organisations are written with", () => {
    expect(orgKey("Team Vitality")).toBe(orgKey("Vitality"));
    expect(orgKey("Lynn Vision Gaming")).toBe(orgKey("Lynn Vision"));
  });

  it("strips only the fixed list — anything looser would file results under the wrong club", () => {
    // "Clan" is deliberately NOT stripped: FaZe Clan is matched through
    // data/team-aliases.json, where the mapping is reviewed by a human.
    expect(orgKey("FaZe Clan")).not.toBe(orgKey("FaZe"));
  });

  it("ignores case, spacing and punctuation", () => {
    expect(orgKey("  NAVI  ")).toBe(orgKey("na'vi"));
  });

  it("does not merge organisations that are genuinely different", () => {
    expect(orgKey("Vitality")).not.toBe(orgKey("Virtus.pro"));
  });
});

/**
 * The self-feeding duplicate bug, measured in production on 2026-08-29.
 *
 * "WW TEAM" normalises to "ww". Two rows with that key made it ambiguous, so it
 * left the index; the importer then failed to find the team and created another
 * row — which made the key no less ambiguous. One organisation reached 42 rows,
 * and the count was a function of how often the importer had run.
 */
describe("indexByOrg", () => {
  it("collapses rows that are the same organisation stored twice", () => {
    const { index, ambiguous } = indexByOrg([
      { id: "old", name: "WW TEAM" },
      { id: "new", name: "WW TEAM" },
    ]);
    expect(ambiguous).toHaveLength(0);
    expect(index.get(orgKey("WW TEAM"))?.id).toBe("old");
  });

  it("resolves to the FIRST row, so matches accumulate on the original", () => {
    const { index } = indexByOrg([
      { id: "first", name: "WW TEAM" },
      { id: "second", name: "WW Team" },
      { id: "third", name: "ww team" },
    ]);
    expect(index.get(orgKey("WW TEAM"))?.id).toBe("first");
  });

  it("still refuses to guess between two different organisations", () => {
    // "Legacy" and "Legacy Esports" normalise together but are not the same club.
    const { index, ambiguous } = indexByOrg([
      { id: "a", name: "Legacy" },
      { id: "b", name: "Legacy Esports" },
    ]);
    expect(ambiguous).toContain(orgKey("Legacy"));
    expect(index.has(orgKey("Legacy"))).toBe(false);
  });

  it("skips names that normalise to nothing", () => {
    const { index } = indexByOrg([{ id: "x", name: "Team" }]);
    expect(index.size).toBe(0);
  });
});
