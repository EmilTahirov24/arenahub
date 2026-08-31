/**
 * Tournament round names — one vocabulary, shared by the importer and the UI.
 *
 * `Match.stage` is a free-text column: an admin types whatever the event calls
 * the round, and Liquipedia writes English names of its own. Both end up here,
 * because the bracket has to answer two questions that a raw string cannot:
 * *is this a playoff match at all*, and *which column does it belong in*.
 *
 * The vocabulary is deliberately closed. `normaliseStage` returns null for
 * anything it does not recognise, and the importer stores null rather than a
 * guess — a match filed under the wrong round is invented data about a real
 * organisation, which is worse than no round at all. Unrecognised strings that
 * an admin typed by hand still survive: they are stored as written and shown as
 * written, they just do not enter the bracket.
 */

export type StageKind =
  /** A playoff match — belongs in the bracket. */
  | "bracket"
  /** A group or league fixture — listed, never bracketed. */
  | "group"
  /** Recognised, but not a bracket column (a play-in, an elimination match). */
  | "other";

/**
 * Which row of the bracket the match sits in.
 *
 * A single-elimination bracket only ever uses `main`. A double-elimination one
 * splits into `main` (upper) and `lower`, and the two meet in the `decider`.
 */
export type StageLane =
  /** The single-elimination tree, or the upper half of a double one. */
  | "main"
  /** The lower half of a double-elimination bracket. */
  | "lower"
  /**
   * Matches that stand outside the tree: the grand final, where the two halves
   * meet, and the third-place match, which is played by two *losers* and so
   * feeds nothing and is fed by nothing.
   */
  | "decider";

export type StageInfo = {
  /** Canonical English label — exactly what is written to `Match.stage`. */
  label: string;
  kind: StageKind;
  lane: StageLane;
  /**
   * Column order inside the lane, low to high. Numbered rounds keep their own
   * number so "Round 1, Round 2, Quarterfinals" sorts correctly, and the named
   * rounds sit above any plausible round number.
   */
  step: number;
};

const QUARTERFINAL = 90;
const SEMIFINAL = 91;
const THIRD_PLACE = 92;
const FINAL = 93;

/** Noise rejected before anything else — see `stageFromComment`. */
const NOT_A_ROUND = /[=|:@#]|https?:\/\//;

/**
 * A Liquipedia round name onto the canonical vocabulary.
 *
 * Returns null when the string is not a round. That happens constantly: the
 * comments this reads sit beside editorial notes ("Don't add unofficial
 * stream, thank you", "Notable confirmed participants", "Server issues:
 * 8647024943"), and only an explicit match may pass.
 */
export function normaliseStage(raw: string | null | undefined): string | null {
  if (!raw) return null;

  let text = raw.replace(/\s+/g, " ").trim().replace(/[.:;,]+$/, "");
  if (!text || text.length > 40 || NOT_A_ROUND.test(text)) return null;

  // The side prefix is stripped first so the rest can be read once, whichever
  // half of a double-elimination bracket it came from. Liquipedia writes the
  // full form in wikitext comments and the abbreviation in rendered headers.
  let side: "upper" | "lower" | null = null;
  const prefix = /^(?:(upper|winners?|ub|wb)|(lower|losers?|lb))\b[' ]*(?:bracket)?\s*/i.exec(text);
  if (prefix && (prefix[1] || prefix[2])) {
    side = prefix[1] ? "upper" : "lower";
    text = text.slice(prefix[0].length).trim();
    // "Upper Bracket" on its own names the half, not a round in it.
    if (!text) return null;
  }

  const round = roundOf(text);
  if (!round) return null;

  // A grand final is the meeting of the two halves and therefore belongs to
  // neither; a side prefix on it is a contradiction and the prefix loses.
  if (round === "Grand Final") return "Grand Final";
  if (!side) return round;
  return `${side === "upper" ? "Upper" : "Lower"} Bracket ${round}`;
}

/** The round part of a name, with any bracket side already removed. */
function roundOf(text: string): string | null {
  const s = text.toLowerCase();

  if (/^grand[- ]?finals?$/.test(s)) return "Grand Final";
  if (/^(third|3rd)[- ]place(\s*(match|decider|game))?$/.test(s)) return "Third Place Match";
  if (/^finals?$/.test(s)) return "Final";
  if (/^semi[- ]?finals?$/.test(s) || s === "sf") return "Semifinal";
  if (/^quarter[- ]?finals?$/.test(s) || s === "qf" || s === "quarters") return "Quarterfinal";
  if (/^play[- ]?offs?$/.test(s)) return "Playoffs";
  if (/^elimination(\s+(round|match))?$/.test(s)) return "Elimination Round";
  if (/^group stage$/.test(s)) return "Group Stage";

  const ro = /^(?:round of|ro)[- ]?(\d{1,3})$/.exec(s);
  if (ro) {
    const size = Number(ro[1]);
    // Powers of two only. "Round of 12" is not a bracket round, and reading it
    // as one would put a group match in a playoff column.
    if (size < 2 || size > 256 || (size & (size - 1)) !== 0) return null;
    // The last three rounds have names of their own, and a page can use either
    // notation for them. Folding them here means one round is never two labels.
    if (size === 2) return "Final";
    if (size === 4) return "Semifinal";
    if (size === 8) return "Quarterfinal";
    return `Round of ${size}`;
  }

  const numbered = /^(?:round|r)[- ]?(\d{1,2})$/.exec(s);
  if (numbered) {
    const n = Number(numbered[1]);
    if (n >= 1 && n <= 20) return `Round ${n}`;
  }

  // "Group A", "Group B2" — the letter is kept because a page lists several.
  const group = /^group ([a-z0-9]{1,3})$/.exec(s);
  if (group) return `Group ${group[1].toUpperCase()}`;

  return null;
}

/**
 * What a stored stage means. Null for a string outside the vocabulary — an
 * admin's free text, which is displayed as written but never bracketed.
 */
export function describeStage(stored: string | null | undefined): StageInfo | null {
  const label = normaliseStage(stored);
  if (!label) return null;

  if (label === "Grand Final") return { label, kind: "bracket", lane: "decider", step: 0 };
  if (label === "Third Place Match") return { label, kind: "bracket", lane: "decider", step: 1 };
  if (label === "Group Stage" || label.startsWith("Group ")) {
    return { label, kind: "group", lane: "main", step: 0 };
  }
  if (label === "Playoffs" || label === "Elimination Round") {
    return { label, kind: "other", lane: "main", step: 0 };
  }

  const lower = label.startsWith("Lower Bracket ");
  const lane: StageLane = lower ? "lower" : "main";
  const round = label.replace(/^(Upper|Lower) Bracket /, "");

  return { label, kind: "bracket", lane, step: stepOf(round) };
}

function stepOf(round: string): number {
  if (round === "Final") return FINAL;
  if (round === "Third Place Match") return THIRD_PLACE;
  if (round === "Semifinal") return SEMIFINAL;
  if (round === "Quarterfinal") return QUARTERFINAL;

  // The wider the field still is, the earlier the column: Round of 128 comes
  // before Round of 64, and both before Round of 16. Subtracting from a fixed
  // base keeps them ordered among themselves and below the named rounds.
  const ro = /^Round of (\d+)$/.exec(round);
  if (ro) return 40 - Math.log2(Number(ro[1]));

  const n = /^Round (\d+)$/.exec(round);
  if (n) return Number(n[1]);

  return 0;
}

/** True when the match belongs in the bracket rather than the match list. */
export function isBracketStage(stored: string | null | undefined): boolean {
  return describeStage(stored)?.kind === "bracket";
}

const AZ: Record<string, string> = {
  "Grand Final": "Böyük final",
  Final: "Final",
  Semifinal: "Yarı final",
  Quarterfinal: "Çeyrək final",
  "Third Place Match": "3-cü yer uğrunda",
  Playoffs: "Pley-off",
  "Elimination Round": "Eliminasiya raundu",
  "Group Stage": "Qrup mərhələsi",
};

/**
 * The label a reader sees. Anything outside the vocabulary — an admin's own
 * wording — is returned untouched in both languages rather than dropped.
 */
export function stageName(stored: string | null | undefined, locale: string): string {
  const raw = (stored ?? "").trim();
  if (!raw) return "";
  const label = normaliseStage(raw) ?? raw;
  if (locale !== "az") return label;

  const direct = AZ[label];
  if (direct) return direct;

  const side = label.startsWith("Upper Bracket ")
    ? "Yuxarı bracket"
    : label.startsWith("Lower Bracket ")
      ? "Aşağı bracket"
      : null;
  const round = label.replace(/^(Upper|Lower) Bracket /, "");
  const body = AZ[round] ?? azRound(round);
  return side ? `${side} — ${body}` : body;
}

function azRound(round: string): string {
  // "Round of 16" reads as "1/8 final" in Azerbaijani sports coverage: the
  // fraction names the share of the field still playing, not the team count.
  const ro = /^Round of (\d+)$/.exec(round);
  if (ro) return `1/${Number(ro[1]) / 2} final`;

  const numbered = /^Round (\d+)$/.exec(round);
  if (numbered) return `${numbered[1]}-${azOrdinal(Number(numbered[1]))} raund`;

  const group = /^Group ([A-Z0-9]{1,3})$/.exec(round);
  if (group) return `${group[1]} qrupu`;

  return round;
}

/**
 * The Azerbaijani ordinal suffix for a round number.
 *
 * It follows vowel harmony with how the number is *said*, not how it is
 * written: üç → üçüncü, altı → altıncı, doqquz → doqquzuncu. A single "-ci"
 * everywhere would misspell more than half of them.
 */
function azOrdinal(n: number): string {
  const byLastDigit = ["cu", "ci", "ci", "cü", "cü", "ci", "cı", "ci", "ci", "cu"];
  // A round number of ten reads "on", of twenty "iyirmi" — the two whole tens
  // a bracket can plausibly reach, and they do not harmonise the same way.
  if (n % 10 === 0) return n === 20 ? "ci" : "cu";
  return byLastDigit[n % 10];
}

/**
 * The round on its own, without the bracket half.
 *
 * A double-elimination bracket is drawn as two labelled rows, so repeating
 * "Upper Bracket" on every column above the row that already says it is noise.
 */
export function stageRoundName(stored: string | null | undefined, locale: string): string {
  const label = normaliseStage(stored);
  if (!label) return stageName(stored, locale);
  return stageName(label.replace(/^(Upper|Lower) Bracket /, ""), locale);
}

/** Heading for a row of the bracket. */
export function laneName(lane: StageLane, locale: string): string {
  if (lane === "lower") return locale === "az" ? "Aşağı bracket" : "Lower bracket";
  if (lane === "main") return locale === "az" ? "Yuxarı bracket" : "Upper bracket";
  return "";
}

/**
 * The rounds an admin can pick from, in bracket order.
 *
 * The field stays free text — an event can call a round something this list
 * does not have, and losing that is worse than an untidy value. The list is a
 * suggestion, and it exists because a hand-typed round that the vocabulary
 * cannot read is a match that quietly stays out of the bracket.
 */
export const STAGE_SUGGESTIONS = [
  "Round of 32",
  "Round of 16",
  "Quarterfinal",
  "Semifinal",
  "Final",
  "Third Place Match",
  "Upper Bracket Round 1",
  "Upper Bracket Quarterfinal",
  "Upper Bracket Semifinal",
  "Upper Bracket Final",
  "Lower Bracket Round 1",
  "Lower Bracket Round 2",
  "Lower Bracket Quarterfinal",
  "Lower Bracket Semifinal",
  "Lower Bracket Final",
  "Grand Final",
  "Group Stage",
] as const;

/** Column order for a bracket, left to right. */
export function stageSort(a: StageInfo, b: StageInfo): number {
  const lane = (s: StageLane) => (s === "main" ? 0 : s === "lower" ? 1 : 2);
  return lane(a.lane) - lane(b.lane) || a.step - b.step || a.label.localeCompare(b.label);
}
