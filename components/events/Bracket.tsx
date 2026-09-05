import { Link } from "@/i18n/navigation";
import TeamAvatar from "@/components/common/TeamAvatar";
import type { Match, Team } from "@/app/generated/prisma/client";
import {
  describeStage,
  laneName,
  stageRoundName,
  stageName,
  stageSort,
  type StageInfo,
  type StageLane,
} from "@/lib/stages";

type BracketMatch = Match & { teamA: Team; teamB: Team };

/* ------------------------------------------------------------------ *
 * Dimensions
 *
 * The bracket is drawn with absolute positions, so the numbers live here once:
 * where a slot sits, the path a connecting line takes and the total height of
 * the box are all derived from them.
 * ------------------------------------------------------------------ */

const SLOT_W = 208;
const SLOT_H = 52;
/** One row = a slot plus the gap under it. Positions are stored as multiples of this. */
const ROW_H = 66;
const COL_GAP = 44;
const COL_W = SLOT_W + COL_GAP;
const HEADER_H = 22;
/** The row the "Upper bracket" label gets to itself in a double-elimination tree. */
const LANE_LABEL_H = 18;
/** Gap between the upper and lower brackets, in pixels. */
const LANE_SPACING = 34;

/* ------------------------------------------------------------------ *
 * Building the tree from the data
 * ------------------------------------------------------------------ */

type Column = { info: StageInfo; matches: BracketMatch[]; col: number };

/**
 * For each match: which match each of its sides arrived from.
 *
 * The rule is checkable and invents nothing. If a team plays in this match, the
 * route it took here is the last match it WON before arriving — so for each
 * side we look left through the earlier columns for the most recent match that
 * team won.
 *
 * Only one of the two sides having a line is normal, not a gap: in a lower
 * bracket one team arrives as a winner while the other drops in having LOST
 * above. No line is drawn for a loss — drawn, a reader would follow it as a
 * path to victory.
 */
function buildEdges(placed: Map<string, { match: BracketMatch; col: number }>) {
  const edges: { from: string; to: string }[] = [];
  // The third-place match sits outside the tree: teams reach it by LOSING,
  // not by winning, and it feeds nothing. Drawing a victory line into it would
  // read as MOUZ winning a quarterfinal and being "promoted" to the third-place
  // match — when in fact there is a lost semifinal in between.
  const all = [...placed.values()].filter(
    ({ match }) => describeStage(match.stage)?.label !== "Third Place Match",
  );

  for (const { match, col } of all) {
    for (const teamId of [match.teamAId, match.teamBId]) {
      let best: { id: string; col: number } | null = null;
      for (const other of all) {
        if (other.match.id === match.id || other.col >= col) continue;
        if (other.match.winnerId !== teamId) continue;
        if (!best || other.col > best.col) best = { id: other.match.id, col: other.col };
      }
      if (best) edges.push({ from: best.id, to: match.id });
    }
  }

  return edges;
}

/**
 * Row positions.
 *
 * A match sits at the average height of the matches feeding it — that is what
 * makes a bracket readable at a glance. A match whose feeders are unknown falls
 * to the next free row: not every team is in the database, so some trees arrive
 * incomplete, and the layout has to cope with that rather than refuse to draw.
 */
function assignRows(columns: Column[], edges: { from: string; to: string }[]) {
  const feeders = new Map<string, string[]>();
  for (const e of edges) feeders.set(e.to, [...(feeders.get(e.to) ?? []), e.from]);

  const row = new Map<string, number>();

  for (const column of columns) {
    const items = column.matches.map((match, index) => {
      const known = (feeders.get(match.id) ?? []).map((id) => row.get(id)).filter((r): r is number => r != null);
      const pos = known.length ? known.reduce((a, b) => a + b, 0) / known.length : null;
      return { match, index, pos };
    });

    // Sorted by the computed position, with the unknown ones last and keeping
    // their original order. Neighbours are then pushed apart so none overlap.
    items.sort((a, b) => (a.pos ?? Number.POSITIVE_INFINITY) - (b.pos ?? Number.POSITIVE_INFINITY) || a.index - b.index);

    let last = Number.NEGATIVE_INFINITY;
    for (const item of items) {
      const wanted = item.pos ?? Math.max(last + 1, 0);
      const placed = wanted <= last ? last + 1 : wanted;
      row.set(item.match.id, placed);
      last = placed;
    }

    column.matches = items.map((i) => i.match);
  }

  return row;
}

/** Centres a column vertically when nothing feeds into it. */
function centreLooseColumns(columns: Column[], row: Map<string, number>, edges: { from: string; to: string }[]) {
  const fed = new Set(edges.map((e) => e.to));
  const height = Math.max(...[...row.values()], 0) + 1;

  for (const column of columns) {
    if (column.matches.some((m) => fed.has(m.id))) continue;
    // When the data says nothing, pinning the column to the top is not a claim
    // either — it is just ugly. Centring gives the bracket its familiar shape.
    const shift = (height - column.matches.length) / 2;
    if (shift <= 0) continue;
    for (const m of column.matches) row.set(m.id, (row.get(m.id) ?? 0) + shift);
  }
}

/* ------------------------------------------------------------------ *
 * Rendering
 * ------------------------------------------------------------------ */

function Slot({ match, x, y }: { match: BracketMatch; x: number; y: number }) {
  const isFinished = match.status === "FINISHED";
  const isLive = match.status === "LIVE";

  return (
    <Link
      href={`/matches/${match.slug}`}
      style={{ left: x, top: y, width: SLOT_W, height: SLOT_H }}
      className={`absolute flex overflow-hidden rounded-lg border bg-surface transition-colors hover:bg-surface-raised ${
        isLive ? "border-live/60" : "border-border-subtle"
      }`}
    >
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        {[
          { team: match.teamA, score: match.teamAScore, won: isFinished && match.winnerId === match.teamAId },
          { team: match.teamB, score: match.teamBScore, won: isFinished && match.winnerId === match.teamBId },
        ].map(({ team, score, won }, i) => (
          <div
            key={team.id}
            className={`flex h-[25px] items-center gap-2 px-2 ${
              i === 0 ? "border-b border-border-subtle" : ""
            } ${won ? "bg-brand-via/10" : ""}`}
          >
            <TeamAvatar name={team.name} logoUrl={team.logoUrl} color={team.primaryColor} size={18} />
            <span
              className={`min-w-0 flex-1 truncate text-xs ${
                won ? "font-semibold text-foreground" : "text-foreground-muted"
              }`}
            >
              {team.name}
            </span>
            <span className="font-display w-3 shrink-0 text-right text-xs font-bold tabular-nums">
              {isFinished || isLive ? score : ""}
            </span>
          </div>
        ))}
      </div>

      {/* Format öz sütununda oturur, hesabın üstündə yox.
          Əvvəl künc nişanı idi və yuxarı komandanın hesabını örtürdü — 2-0
          matçda «2» görünmürdü. Format seriyanı oxumağın bir hissəsidir: 2-0
          BO3-də qələbə, BO5-də hələ bitməmiş matçdır. */}
      <span className="font-display flex w-7 shrink-0 items-center justify-center border-l border-border-subtle text-[9px] font-bold uppercase leading-none text-foreground-muted">
        BO{match.bestOf}
      </span>
    </Link>
  );
}

/**
 * One lane: the upper bracket, the lower bracket, or the deciding column on
 * the right.
 *
 * Each lane gets its OWN header row. The headers used to share a single row,
 * which collided whenever the upper and lower brackets had different numbers of
 * columns: at VCT EMEA the upper bracket's "Semifinal" landed on top of the
 * lower bracket's "Quarterfinal" and neither could be read.
 */
type Lane = {
  name: string | null;
  columns: Column[];
  /** Row numbers within this lane. */
  rows: Map<string, number>;
  /** How many rows the lane occupies. */
  rowCount: number;
};

export default function Bracket({ matches, locale }: { matches: BracketMatch[]; locale: string }) {
  const byLabel = new Map<string, { info: StageInfo; matches: BracketMatch[] }>();
  for (const match of matches) {
    const info = describeStage(match.stage);
    if (!info || info.kind !== "bracket") continue;
    const column = byLabel.get(info.label) ?? { info, matches: [] };
    column.matches.push(match);
    byLabel.set(info.label, column);
  }

  const sorted = [...byLabel.values()].sort((a, b) => stageSort(a.info, b.info));
  if (sorted.length === 0) return null;
  for (const column of sorted) {
    column.matches.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  }

  const inLane = (lane: StageLane) =>
    sorted.filter((c) => c.info.lane === lane).map((c, i) => ({ ...c, col: i }));

  const main = inLane("main");
  const lower = inLane("lower");
  // The grand final and the third-place match stand one above the other in a
  // single column on the right: both are outcomes of the two halves and belong
  // to no round of their own.
  const deciderCol = Math.max(main.length, lower.length);
  const decider = sorted
    .filter((c) => c.info.lane === "decider")
    .map((c) => ({ ...c, col: deciderCol }));

  const placed = new Map<string, { match: BracketMatch; col: number }>();
  for (const column of [...main, ...lower, ...decider]) {
    for (const match of column.matches) placed.set(match.id, { match, col: column.col });
  }
  const edges = buildEdges(placed);

  const doubleElimination = main.length > 0 && lower.length > 0;

  const buildLane = (name: string | null, columns: Column[]): Lane | null => {
    if (columns.length === 0) return null;
    const rows = assignRows(columns, edges);
    centreLooseColumns(columns, rows, edges);
    return { name, columns, rows, rowCount: Math.max(...[...rows.values()], 0) + 1 };
  };

  const lanes = [
    buildLane(doubleElimination ? laneName("main", locale) : null, main),
    buildLane(doubleElimination ? laneName("lower", locale) : null, lower),
  ].filter((l): l is Lane => l !== null);

  // Absolute positions are computed in pixels: each lane brings its own label
  // and header row, so a row number alone does not give a y coordinate.
  const y = new Map<string, number>();
  const headerRows: { at: number; columns: Column[] }[] = [];
  const laneLabels: { at: number; text: string }[] = [];

  let cursor = 0;
  for (const lane of lanes) {
    if (lane.name) {
      laneLabels.push({ at: cursor, text: lane.name });
      cursor += LANE_LABEL_H;
    }
    headerRows.push({ at: cursor, columns: lane.columns });
    cursor += HEADER_H;
    for (const [id, row] of lane.rows) y.set(id, cursor + row * ROW_H);
    cursor += (lane.rowCount - 1) * ROW_H + SLOT_H + LANE_SPACING;
  }

  const bodyHeight = Math.max(cursor - LANE_SPACING, SLOT_H);

  // The deciding column sits at the middle of the full height.
  if (decider.length > 0) {
    const all = decider.flatMap((c) => c.matches);
    let top = Math.max((bodyHeight - all.length * ROW_H) / 2, HEADER_H);
    headerRows.push({ at: top - HEADER_H, columns: decider });
    for (const match of all) {
      y.set(match.id, top);
      top += ROW_H;
    }
  }

  const columns = [...main, ...lower, ...decider];
  const width = (Math.max(...columns.map((c) => c.col)) + 1) * COL_W - COL_GAP;
  const height = Math.max(bodyHeight, ...[...y.values()].map((v) => v + SLOT_H));

  return (
    <div className="overflow-x-auto pb-2">
      <div className="relative" style={{ width, height }}>
        {laneLabels.map((lane) => (
          <div
            key={lane.text}
            style={{ top: lane.at, height: LANE_LABEL_H }}
            className="font-display absolute left-0 text-[10px] font-bold uppercase leading-[18px] tracking-wide text-foreground-muted"
          >
            {lane.text}
          </div>
        ))}

        {headerRows.map((row, i) =>
          row.columns.map((column) => (
            <div
              key={`${i}-${column.info.label}`}
              style={{ left: column.col * COL_W, top: row.at, width: SLOT_W, height: HEADER_H }}
              className="font-display absolute truncate text-center text-[11px] font-bold uppercase leading-[22px] tracking-wide text-foreground-muted"
            >
              {stageRoundName(column.info.label, locale)}
            </div>
          )),
        )}

        {/* Xətlər kartların altındadır: künc radiusu onları örtsün. */}
        <svg
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 text-border-subtle"
          width={width}
          height={height}
        >
          {edges.map((edge) => {
            const from = placed.get(edge.from);
            const to = placed.get(edge.to);
            const y1 = y.get(edge.from);
            const y2 = y.get(edge.to);
            if (!from || !to || y1 == null || y2 == null) return null;
            const x1 = from.col * COL_W + SLOT_W;
            const x2 = to.col * COL_W;
            const mid = x1 + (x2 - x1) / 2;
            return (
              <path
                key={`${edge.from}-${edge.to}`}
                d={`M ${x1} ${y1 + SLOT_H / 2} H ${mid} V ${y2 + SLOT_H / 2} H ${x2}`}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
              />
            );
          })}
        </svg>

        {columns.map((column) =>
          column.matches.map((match) => (
            <Slot key={match.id} match={match} x={column.col * COL_W} y={y.get(match.id) ?? 0} />
          )),
        )}
      </div>
    </div>
  );
}


/* ------------------------------------------------------------------ *
 * Grouping the brackets on a page
 * ------------------------------------------------------------------ */

export type BracketGroup = {
  key: string;
  label: string | null;
  matches: BracketMatch[];
  /** When the group's first match is played — the ordering is on this. */
  at: number;
};

/**
 * Splits matches into the brackets they belong to, in chronological order.
 *
 * One tournament row holds several trees: IEM Kraków has a play-in, two group
 * brackets and the playoffs, and EACH has its own quarterfinal. `bracketKey`
 * is what separates them — the round name cannot, because the names are
 * identical, and drawing them as one tree put five quarterfinals in a column.
 */
export function groupBrackets(matches: BracketMatch[]): BracketGroup[] {
  const groups = new Map<string, BracketGroup>();

  for (const match of matches) {
    // Rows with no key are gathered together: matches predating the importer and
    // ones an admin typed in. They are still drawn as a tree, just unnamed.
    const key = match.bracketKey ?? "—";
    const group = groups.get(key) ?? {
      key,
      label: match.bracketLabel,
      matches: [],
      at: match.scheduledAt.getTime(),
    };
    group.matches.push(match);
    group.at = Math.min(group.at, match.scheduledAt.getTime());
    groups.set(key, group);
  }

  return [...groups.values()].sort((a, b) => a.at - b.at);
}

/** A bracket whose own name declares it the playoffs. */
const PLAYOFF_LABEL = /playoff|grand final|main event/i;

/**
 * Separates the bracket the tournament is decided in from the rest.
 *
 * The name is tried first: in 10 of 18 tournaments Liquipedia writes "Playoffs"
 * above the bracket outright. The rest carry no name, so the CHRONOLOGICALLY
 * LAST group is taken — a tournament is decided at its end, not its start.
 *
 * This is a presentational split, not a claim about the result: if it splits
 * wrongly, the matches still sit in the right tree and the right round, they
 * simply appear under a different heading.
 */
export function splitPlayoff(groups: BracketGroup[]): {
  playoff: BracketGroup | null;
  earlier: BracketGroup[];
} {
  if (groups.length === 0) return { playoff: null, earlier: [] };

  const named = groups.filter((g) => g.label && PLAYOFF_LABEL.test(g.label));
  // If several are named that way (EWC has two "Playoffs"), the last one is the real one.
  const playoff = named.length > 0 ? named[named.length - 1] : groups[groups.length - 1];

  return { playoff, earlier: groups.filter((g) => g !== playoff) };
}

/** Several brackets one after another, each under its own name. */
export function BracketList({
  groups,
  locale,
  showLabels = true,
}: {
  groups: BracketGroup[];
  locale: string;
  showLabels?: boolean;
}) {
  return (
    <div className="flex flex-col gap-8">
      {groups.map((group) => (
        <div key={group.key}>
          {showLabels && group.label && (
            <h3 className="font-display mb-2 text-sm font-bold">
              {/* Tanınan ad tərcümə olunur (Group A → A qrupu, Playoffs →
                  Pley-off); «Europe Open Qualifier 1» kimi ad olduğu kimi qalır. */}
              {stageName(group.label, locale)}
            </h3>
          )}
          <Bracket matches={group.matches} locale={locale} />
        </div>
      ))}
    </div>
  );
}
