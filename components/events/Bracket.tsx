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
 * Ölçülər
 *
 * Bracket mütləq mövqelərlə çəkilir, ona görə ölçülər burada birdəfəlik
 * yazılır: xanaların yeri, birləşdirici xətlərin yolu və qutunun ümumi
 * hündürlüyü hamısı bu rəqəmlərdən hesablanır.
 * ------------------------------------------------------------------ */

const SLOT_W = 208;
const SLOT_H = 52;
/** Bir sətir = xana + altındakı boşluq. Mövqelər bunun misli kimi saxlanılır. */
const ROW_H = 66;
const COL_GAP = 44;
const COL_W = SLOT_W + COL_GAP;
const HEADER_H = 22;
/** İkili eliminasiyada «Yuxarı bracket» yazısının öz sətri. */
const LANE_LABEL_H = 18;
/** Yuxarı və aşağı bracket arasındakı boşluq, sətir sayı ilə. */
const LANE_GAP = 0.7;

/* ------------------------------------------------------------------ *
 * Ağacın dataya görə qurulması
 * ------------------------------------------------------------------ */

type Column = { info: StageInfo; matches: BracketMatch[]; col: number };

/**
 * Hər matç üçün: tərəflərinin bura hansı matçdan gəldiyi.
 *
 * Qayda yoxlanıla biləndir və uydurmur: komanda bu matçda oynayırsa, bura
 * gəlməzdən əvvəl UDDUĞU ən son matç onun yoludur. Ona görə hər tərəf üçün
 * daha soldakı sütunlardan həmin komandanın qalib olduğu ən son matç axtarılır.
 *
 * İki tərəfdən yalnız birinin xətti olması normaldır: aşağı bracket-də bir
 * komanda qalib kimi gəlir, o biri yuxarıdan MƏĞLUB olub düşür. Məğlubiyyət
 * xətti çəkilmir — çəkilsəydi, oxucu onu qələbə yolu kimi oxuyardı.
 */
function buildEdges(placed: Map<string, { match: BracketMatch; col: number }>) {
  const edges: { from: string; to: string }[] = [];
  // 3-cü yer matçı ağacın kənarındadır: ora QALİB kimi yox, MƏĞLUB olaraq
  // düşürlər və o da heç nə qidalandırmır. Qələbə xətti çəksək, oxucu MOUZ-un
  // çeyrək finalı udub 3-cü yer matçına «yüksəldiyini» oxuyardı — əslində
  // arada uduzduğu yarımfinal var.
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
 * Sətir mövqeləri.
 *
 * Bir matçın yeri onu qidalandıran matçların ortasıdır — bracket-in oxunması
 * elə budur. Qidalandırıcısı bilinməyən matç növbəti boş sətrə düşür; bazada
 * hər komanda yoxdur, ona görə ağacların bir hissəsi natamam gəlir və düzülüş
 * bununla bacarmalıdır, imtina etməməlidir.
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

    // Hesablanmış mövqeyə görə sıralanır; bilinməyənlər sonda, öz sıralarını
    // saxlayaraq. Sonra qonşular üst-üstə düşməsin deyə aralanır.
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

/** Qidalandırıcısı olmayan sütunu şaquli olaraq ortalayır. */
function centreLooseColumns(columns: Column[], row: Map<string, number>, edges: { from: string; to: string }[]) {
  const fed = new Set(edges.map((e) => e.to));
  const height = Math.max(...[...row.values()], 0) + 1;

  for (const column of columns) {
    if (column.matches.some((m) => fed.has(m.id))) continue;
    // Data heç nə demirsə, sütunu yuxarıya yapışdırmaq da bir iddia deyil —
    // sadəcə çirkindir. Ortalamaq bracket-in tanış formasını verir.
    const shift = (height - column.matches.length) / 2;
    if (shift <= 0) continue;
    for (const m of column.matches) row.set(m.id, (row.get(m.id) ?? 0) + shift);
  }
}

/* ------------------------------------------------------------------ *
 * Görünüş
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

function Tree({
  columns,
  rows,
  edges,
  locale,
  width,
  height,
  topPad,
  lanes,
}: {
  columns: Column[];
  rows: Map<string, number>;
  edges: { from: string; to: string }[];
  locale: string;
  width: number;
  height: number;
  /** Sütun adları və zolaq adı üçün yuxarıda ayrılan yer. */
  topPad: number;
  /** İkili eliminasiyada iki yarımın adı və başladığı sətir. */
  lanes: { text: string; row: number }[];
}) {
  const xOf = (col: number) => col * COL_W;
  const yOf = (id: string) => (rows.get(id) ?? 0) * ROW_H;
  const colOf = new Map<string, number>();
  for (const c of columns) for (const m of c.matches) colOf.set(m.id, c.col);

  return (
    <div className="relative" style={{ width, height: height + topPad }}>
      {/* Sütun adları */}
      {columns.map((column) => (
        <div
          key={column.info.label}
          style={{ left: xOf(column.col), width: SLOT_W, height: HEADER_H }}
          className="font-display absolute top-0 truncate text-center text-[11px] font-bold uppercase leading-[22px] tracking-wide text-foreground-muted"
        >
          {stageRoundName(column.info.label, locale)}
        </div>
      ))}

      {/* Zolaq adları öz sətrindədir. Əvvəl xanaların üstündə üzürdü və sol
          sütunun adını örtürdü — «YUXARI BRACKET» ilə «1-Cİ RAUND» bir-birinin
          üstünə düşmüşdü. */}
      {lanes.map((lane) => (
        <div
          key={lane.text}
          style={{ top: topPad + lane.row * ROW_H - LANE_LABEL_H, height: LANE_LABEL_H }}
          className="font-display absolute left-0 text-[10px] font-bold uppercase leading-[18px] tracking-wide text-foreground-muted"
        >
          {lane.text}
        </div>
      ))}

      {/* Xətlər kartların altındadır: künc radiusu onları örtsün. */}
      <svg
        aria-hidden
        className="pointer-events-none absolute text-border-subtle"
        style={{ left: 0, top: topPad, width, height }}
        width={width}
        height={height}
      >
        {edges.map((edge) => {
          const fromCol = colOf.get(edge.from);
          const toCol = colOf.get(edge.to);
          if (fromCol == null || toCol == null) return null;
          const x1 = xOf(fromCol) + SLOT_W;
          const y1 = yOf(edge.from) + SLOT_H / 2;
          const x2 = xOf(toCol);
          const y2 = yOf(edge.to) + SLOT_H / 2;
          const mid = x1 + (x2 - x1) / 2;
          return (
            <path
              key={`${edge.from}-${edge.to}`}
              d={`M ${x1} ${y1} H ${mid} V ${y2} H ${x2}`}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
            />
          );
        })}
      </svg>

      {columns.map((column) =>
        column.matches.map((match) => (
          <Slot key={match.id} match={match} x={xOf(column.col)} y={yOf(match.id) + topPad} />
        )),
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Bir bracket
 * ------------------------------------------------------------------ */

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
  // Böyük final və 3-cü yer matçı ağacın sağında, bir sütunda alt-alta durur:
  // ikisi də iki yarımın nəticəsidir, öz raundları yoxdur.
  const deciderCol = Math.max(main.length, lower.length);
  const decider = sorted
    .filter((c) => c.info.lane === "decider")
    .map((c) => ({ ...c, col: deciderCol }));

  const placed = new Map<string, { match: BracketMatch; col: number }>();
  for (const column of [...main, ...lower, ...decider]) {
    for (const match of column.matches) placed.set(match.id, { match, col: column.col });
  }
  const edges = buildEdges(placed);

  const mainRows = assignRows(main, edges);
  centreLooseColumns(main, mainRows, edges);
  const mainHeight = main.length ? Math.max(...[...mainRows.values()]) + 1 : 0;

  const lowerRows = assignRows(lower, edges);
  centreLooseColumns(lower, lowerRows, edges);

  const rows = new Map(mainRows);
  const offset = mainHeight ? mainHeight + LANE_GAP : 0;
  for (const [id, r] of lowerRows) rows.set(id, r + offset);

  const bodyHeight = Math.max(...[...rows.values(), 0]) + 1;

  // Sağdakı sütun bütün hündürlüyün ortasında oturur.
  let deciderRow = (bodyHeight - 1) / 2;
  for (const column of decider) {
    for (const match of column.matches) {
      rows.set(match.id, deciderRow);
      deciderRow += 1;
    }
  }

  const columns = [...main, ...lower, ...decider];
  const totalRows = Math.max(...[...rows.values(), 0]) + 1;
  const width = (Math.max(...columns.map((c) => c.col)) + 1) * COL_W - COL_GAP;
  const height = totalRows * ROW_H - (ROW_H - SLOT_H);

  const doubleElimination = main.length > 0 && lower.length > 0;
  const lanes = doubleElimination
    ? [
        { text: laneName("main", locale), row: 0 },
        { text: laneName("lower", locale), row: offset },
      ]
    : [];

  return (
    <div className="overflow-x-auto pb-2">
      <Tree
        columns={columns}
        rows={rows}
        edges={edges}
        locale={locale}
        width={width}
        height={height}
        topPad={HEADER_H + (doubleElimination ? LANE_LABEL_H : 0)}
        lanes={lanes}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Səhifədəki bracket-lərin qruplaşdırılması
 * ------------------------------------------------------------------ */

export type BracketGroup = {
  key: string;
  label: string | null;
  matches: BracketMatch[];
  /** Qrupun ilk matçının vaxtı — sıralama bunun üzərindədir. */
  at: number;
};

/**
 * Matçları aid olduqları bracket-lərə bölür, xronoloji sıra ilə.
 *
 * Bir turnir sətri bir neçə ağac saxlayır: IEM Kraków-da play-in, iki qrup
 * bracket-i və pley-off var və HƏR BİRİNİN öz çeyrək finalı. Onları
 * `bracketKey` ayırır — mərhələnin adı ayıra bilmir, çünki adlar eynidir və
 * hamısını bir ağac kimi çəkmək bir sütunda beş çeyrək final göstərirdi.
 */
export function groupBrackets(matches: BracketMatch[]): BracketGroup[] {
  const groups = new Map<string, BracketGroup>();

  for (const match of matches) {
    // Açarsızlar bir yerə yığılır: idxaldan əvvəlki sətirlər və adminin əl ilə
    // yazdıqları. Onlar da ağac kimi göstərilir, sadəcə adsız.
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

/** Adı özünü pley-off elan edən bracket. */
const PLAYOFF_LABEL = /playoff|grand final|main event/i;

/**
 * Turnirin həll olunduğu bracket-i qalanlarından ayırır.
 *
 * Əvvəlcə ada baxılır: 18 turnirin 10-unda Liquipedia bracket-in üstünə açıq
 * «Playoffs» yazır. Qalanlarında ad yoxdur, ona görə XRONOLOJİ SONUNCU qrup
 * götürülür — turnir sonda həll olunur, əvvəldə yox.
 *
 * Bu bir təqdimat bölgüsüdür, nəticə haqqında iddia deyil: səhv bölünsə,
 * matçlar yenə düzgün ağacda və düzgün raundda qalır, sadəcə başqa başlığın
 * altında görünür.
 */
export function splitPlayoff(groups: BracketGroup[]): {
  playoff: BracketGroup | null;
  earlier: BracketGroup[];
} {
  if (groups.length === 0) return { playoff: null, earlier: [] };

  const named = groups.filter((g) => g.label && PLAYOFF_LABEL.test(g.label));
  // Bir neçəsi belə adlanırsa (EWC-də iki «Playoffs» var), sonuncusu əsasdır.
  const playoff = named.length > 0 ? named[named.length - 1] : groups[groups.length - 1];

  return { playoff, earlier: groups.filter((g) => g !== playoff) };
}

/** Bir neçə bracket-i ardıcıl, hərəsi öz adı ilə. */
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
