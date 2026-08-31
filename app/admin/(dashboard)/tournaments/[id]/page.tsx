import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import TournamentForm from "@/components/admin/TournamentForm";
import AdminRowForm from "@/components/admin/AdminRowForm";
import { updateTournament, deleteTournament, addParticipant, removeParticipant, setParticipantPlacement, addPrize, removePrize } from "../actions";
import { placeRangeLabel, formatMoney } from "@/lib/prizes";
import { dangerButtonClass, inputClass, labelClass, secondaryButtonClass } from "@/components/admin/formStyles";
import { groupBrackets, splitPlayoff } from "@/components/events/Bracket";
import { isBracketStage, stageName, describeStage } from "@/lib/stages";
import { siteFormat } from "@/lib/dates";


/**
 * Admin panelində ani naviqasiya məqsəd deyil.
 *
 * Bu səhifələr hər açılışda bazadan TƏZƏ data oxuyur — admin dünənki siyahını
 * görməməlidir. Next isə keşlənməmiş oxunu ani naviqasiyanın qarşısını alan
 * hal kimi bildirir və dev konsolunu bu xəbərdarlıqla doldurur; e2e onları
 * problem kimi yığır və REAL konsol səhvləri həmin siyahıda itir.
 *
 * `instant = false` seçimi sənədin təklif etdiyi «Allow blocking route»
 * variantıdır: production davranışı dəyişmir, sadəcə niyyət yazılır.
 */
export const instant = false;

export default async function EditTournamentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [tournament, games] = await Promise.all([
    prisma.tournament.findUnique({ where: { id } }),
    prisma.game.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!tournament) notFound();

  const participants = await prisma.tournamentParticipant.findMany({
    where: { tournamentId: id },
    include: { team: true },
    orderBy: { seed: "asc" },
  });

  const prizes = await prisma.tournamentPrize.findMany({
    where: { tournamentId: id },
    orderBy: { placeFrom: "asc" },
  });

  const tournamentMatches = await prisma.match.findMany({
    where: { tournamentId: id },
    orderBy: { scheduledAt: "asc" },
    include: { teamA: true, teamB: true },
  });

  /**
   * Bölgü public səhifə ilə EYNİ funksiyalarla hesablanır.
   *
   * Ayrıca məntiq yazsaydıq, admin bir şey görər, ziyarətçi başqa şey görərdi —
   * və fərq yalnız sayt canlıya çıxandan sonra üzə çıxardı. Burada nə görünürsə,
   * turnir səhifəsində də o görünəcək.
   */
  const bracketMatches = tournamentMatches.filter((m) => isBracketStage(m.stage));
  const looseMatches = tournamentMatches.filter((m) => !isBracketStage(m.stage));
  const { playoff, earlier } = splitPlayoff(groupBrackets(bracketMatches));
  const beforePlayoff = [...earlier.flatMap((g) => g.matches), ...looseMatches].sort(
    (a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime(),
  );
  const whenFmt = siteFormat("az", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

  const matchRow = (m: (typeof tournamentMatches)[number]) => {
    // Mərhələ yazılıb, amma lüğətdə yoxdursa, matç kartında görünür və cədvələ
    // düşmür. Bu, səssiz uğursuzluqdur — admin onu burada görməlidir.
    const unknownStage = m.stage != null && describeStage(m.stage) === null;
    return (
      <Link
        key={m.id}
        href={`/admin/matches/${m.id}`}
        className="flex flex-wrap items-center gap-2 rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm hover:bg-surface-raised"
      >
        <span className="min-w-0 flex-1 truncate">
          {m.teamA.name} <span className="text-foreground-muted">vs</span> {m.teamB.name}
        </span>
        {m.stage && (
          <span className={unknownStage ? "shrink-0 text-xs text-live" : "shrink-0 text-xs text-foreground-muted"}>
            {unknownStage ? `${m.stage} — cədvələ girmir` : stageName(m.stage, "az")}
          </span>
        )}
        <span className="shrink-0 text-xs tabular-nums text-foreground-muted">{whenFmt.format(m.scheduledAt)}</span>
      </Link>
    );
  };
  const participantTeamIds = participants.map((p) => p.teamId);
  const availableTeams = await prisma.team.findMany({
    where: { gameId: tournament.gameId, id: { notIn: participantTeamIds } },
    orderBy: { name: "asc" },
  });

  const updateWithId = updateTournament.bind(null, id);
  const deleteWithId = deleteTournament.bind(null, id);
  const addParticipantWithId = addParticipant.bind(null, id);
  const removeParticipantWithId = removeParticipant.bind(null, id);
  const setPlacementWithId = setParticipantPlacement.bind(null, id);
  const addPrizeWithId = addPrize.bind(null, id);
  const removePrizeWithId = removePrize.bind(null, id);

  return (
    <div>
      <h1 className="font-display mb-6 text-2xl font-bold">{tournament.name}</h1>
      <TournamentForm tournament={tournament} games={games} action={updateWithId} />

      <div className="mt-10 max-w-lg">
        <h2 className="font-display mb-1 text-lg font-bold">Qatılanlar</h2>
        <p className="mb-3 text-xs text-foreground-muted">
          <b className="text-foreground">Seed</b> — komandanın turnir başlamazdan əvvəlki sıra nömrəsi:
          1 ən güclü sayılan komandadır. Təşkilatçı cütləşməni ona görə qurur (1-ci sonuncu ilə oynayır),
          burada isə siyahını həmin sıra ilə düzür. Bilmirsənsə boş qoy — seed-siz komandalar sonda görünür.
          <br />
          <b className="text-foreground">Yer</b> isə turnir bitəndən sonrakı nəticədir — mükafat ondan hesablanır.
        </p>
        <div className="space-y-2">
          {participants.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border-subtle bg-surface px-3 py-2">
              <span className="flex-1 truncate text-sm">
                {p.team.name} {p.seed != null && <span className="text-foreground-muted">· seed {p.seed}</span>}
              </span>
              {/* Placement drives the prize each team is shown, via the breakdown below. */}
              <AdminRowForm
                action={setPlacementWithId.bind(null, p.id)}
                submitLabel="yaz"
                submitClassName="text-xs text-brand-via-fg hover:underline disabled:opacity-60"
                className="flex items-center gap-1"
              >
                <input
                  name="placement"
                  type="number"
                  min="1"
                  placeholder="yer"
                  defaultValue={p.placement ?? ""}
                  className="w-20 rounded-md border border-border-subtle bg-background px-2 py-1 text-sm"
                />
              </AdminRowForm>
              <form action={removeParticipantWithId.bind(null, p.id)}>
                <button type="submit" className="text-xs text-live hover:underline">
                  çıxar
                </button>
              </form>
            </div>
          ))}
          {participants.length === 0 && <p className="text-sm text-foreground-muted">Qatılan komanda yoxdur.</p>}
        </div>

        <AdminRowForm
          action={addParticipantWithId}
          submitLabel="Əlavə et"
          submitClassName={secondaryButtonClass}
          className="mt-4 flex flex-wrap items-end gap-2"
        >
          <div className="min-w-[12rem] flex-1">
            <label htmlFor="tournaments-id-teamId" className={labelClass}>Komanda</label>
            <select id="tournaments-id-teamId" name="teamId" required className={inputClass}>
              <option value="">Seçin</option>
              {availableTeams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="w-24">
            <label htmlFor="tournaments-id-seed" className={labelClass}>Seed</label>
            <input id="tournaments-id-seed" name="seed" type="number" min="1" className={inputClass} />
          </div>
        </AdminRowForm>
      </div>

      <div className="mt-10 max-w-lg">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold">Matçlar</h2>
          <Link href={`/admin/matches/new?tournamentId=${tournament.id}`} className={secondaryButtonClass}>
            Matç əlavə et
          </Link>
        </div>
        <p className="mb-3 text-xs text-foreground-muted">
          Komandaları burada qarşılaşdırırsan. <b className="text-foreground">Matç əlavə et</b> düyməsi oyunu və
          turniri özü doldurur — sən iki komandanı, vaxtı və <b className="text-foreground">mərhələni</b> seçirsən.
          <br />
          Bölgü mərhələdən çıxır: çeyrək final, yarı final, final kimi mərhələlər turnir səhifəsində{" "}
          <b className="text-foreground">pley-off cədvəlinə</b> düşür; qrup mərhələsi və mərhələsi yazılmayanlar{" "}
          <b className="text-foreground">pley-off öncəsi</b> bölməsində qalır.
        </p>

        {tournamentMatches.length === 0 && <p className="text-sm text-foreground-muted">Hələ matç yoxdur.</p>}

        {playoff && (
          <div className="mb-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">
              Pley-off{playoff.label ? ` · ${playoff.label}` : ""}
            </h3>
            <div className="space-y-2">{playoff.matches.map(matchRow)}</div>
          </div>
        )}

        {beforePlayoff.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">
              Pley-off öncəsi
            </h3>
            <div className="space-y-2">{beforePlayoff.map(matchRow)}</div>
          </div>
        )}
      </div>

      <div className="mt-10 max-w-lg">
        <h2 className="font-display mb-1 text-lg font-bold">Mükafat bölgüsü</h2>
        <p className="mb-3 text-xs text-foreground-muted">
          <b className="text-foreground">Tək yer:</b> «Yerdən» yaz, «Yerə» boş qoy — məsələn <b>2</b> → 2-ci yer $50 000.
          <br />
          <b className="text-foreground">Aralıq:</b> hər ikisini yaz — <b>5</b> və <b>8</b> → 5-8-ci yerlər $10 000.
          <br />
          İkisi bir yerdə də işləyir: geniş aralıq yazıb sonra bir yerə ayrıca məbləğ verə bilərsən —
          dar sətir geniş aralığı üstələyir. Komandanın mükafatı öz yerindən avtomatik çıxır, ayrıca yazılmır.
        </p>
        <div className="space-y-2">
          {prizes.map((prize) => (
            <div key={prize.id} className="flex items-center justify-between rounded-lg border border-border-subtle bg-surface px-3 py-2">
              <span className="text-sm">
                {placeRangeLabel(prize, "az")}
                {prize.label && <span className="text-foreground-muted"> · {prize.label}</span>}
              </span>
              <span className="flex items-center gap-3">
                <span className="text-sm tabular-nums text-positive">{formatMoney(prize.amount)}</span>
                <form action={removePrizeWithId.bind(null, prize.id)}>
                  <button type="submit" className="text-xs text-live hover:underline">
                    sil
                  </button>
                </form>
              </span>
            </div>
          ))}
          {prizes.length === 0 && <p className="text-sm text-foreground-muted">Bölgü yazılmayıb.</p>}
        </div>

        <AdminRowForm
          action={addPrizeWithId}
          submitLabel="Əlavə et"
          submitClassName={secondaryButtonClass}
          className="mt-4 flex flex-wrap items-end gap-2"
        >
          <div className="w-20">
            <label htmlFor="tournaments-id-placeFrom" className={labelClass}>Yerdən</label>
            <input id="tournaments-id-placeFrom" name="placeFrom" type="number" min="1" required className={inputClass} />
          </div>
          <div className="w-20">
            <label htmlFor="tournaments-id-placeTo" className={labelClass}>Yerə</label>
            {/* Məcburi deyil: boş qalanda server onu «Yerdən» ilə eyni sayır, yəni tək yer. */}
            <input
              id="tournaments-id-placeTo"
              name="placeTo"
              type="number"
              min="1"
              placeholder="tək yer"
              className={inputClass}
            />
          </div>
          <div className="w-32">
            <label htmlFor="tournaments-id-amount" className={labelClass}>Məbləğ ($)</label>
            <input id="tournaments-id-amount" name="amount" type="number" min="0" required className={inputClass} />
          </div>
          <div className="w-28">
            <label htmlFor="tournaments-id-label" className={labelClass}>Qeyd</label>
            <input id="tournaments-id-label" name="label" placeholder="Winner" className={inputClass} />
          </div>
        </AdminRowForm>
      </div>

      <div className="mt-8">
        {/* Ölçüldü: turnir silinəndə matçlar SİLİNMİR — tournamentId null olur
            və matç saytda turnirsiz qalır. Bu, geri qaytarıla bilməyən
            əməliyyatdır, ona görə nəticəsi düymədən ƏVVƏL yazılır. */}
        {tournamentMatches.length > 0 && (
          <p className="mb-2 max-w-lg rounded-md border border-live/40 bg-live/10 px-3 py-2 text-xs text-live">
            Bu turnirin <b>{tournamentMatches.length} matçı</b> var. Turnir silinəndə matçlar silinmir —
            turnirsiz qalır və saytda turnir adı olmadan görünür.
            {participants.length > 0 && <> İştirakçı sətirləri və mükafat bölgüsü isə silinir.</>}
          </p>
        )}
        <form action={deleteWithId}>
          <button type="submit" className={dangerButtonClass}>
            Turniri sil
          </button>
        </form>
      </div>
    </div>
  );
}
