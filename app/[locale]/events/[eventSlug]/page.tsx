import { notFound } from "next/navigation";
import { cacheLife } from "next/cache";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import PageShell from "@/components/layout/PageShell";
import TeamAvatar from "@/components/common/TeamAvatar";
import GameChip from "@/components/common/GameChip";
import MatchCard from "@/components/matches/MatchCard";
import { BracketList, groupBrackets, splitPlayoff } from "@/components/events/Bracket";
import { placeRangeLabel, formatMoney, prizeForPlacement } from "@/lib/prizes";
import JsonLd from "@/components/seo/JsonLd";
import { tournamentJsonLd } from "@/lib/structuredData";
import { localeAlternates } from "@/lib/localeAlternates";
import { siteFormat } from "@/lib/dates";
import { isBracketStage } from "@/lib/stages";

/**
 * Mərhələ adları `lib/stages.ts`-dədir.
 *
 * Əvvəl burada beş sətirlik bir siyahı vardı və Liquipedia-nın yazdığı adların
 * heç biri ona düşmürdü — 2503 matçın 0-ının mərhələsi bilinirdi, ona görə
 * bracket heç vaxt ekrana çıxmırdı. İndi lüğət idxalçı ilə ortaqdır: idxal nə
 * yazırsa, səhifə də onu tanıyır.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; eventSlug: string }>;
}): Promise<Metadata> {
  const { locale, eventSlug } = await params;
  const tournament = await prisma.tournament.findUnique({ where: { slug: eventSlug }, include: { game: true } });
  if (!tournament) return {};
  return {
    alternates: localeAlternates(locale, `/events/${eventSlug}`), title: `${tournament.name} — ${tournament.game.name}` };
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ locale: string; eventSlug: string }>;
}) {
  "use cache";
  // İdxal saatda bir dəfə işləyir, admin dəyişiklikləri isə revalidatePath ilə
  // dərhal ləğv olunur — ona görə bir dəqiqəlik pəncərə datanı köhnəltmir.
  cacheLife("minutes");

  const { locale, eventSlug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const tournament = await prisma.tournament.findUnique({
    where: { slug: eventSlug },
    include: { game: true },
  });
  if (!tournament) notFound();

  const [participants, matches, prizes] = await Promise.all([
    prisma.tournamentParticipant.findMany({
      where: { tournamentId: tournament.id },
      orderBy: [{ placement: "asc" }, { seed: "asc" }],
      include: { team: true },
    }),
    prisma.match.findMany({
      where: { tournamentId: tournament.id },
      orderBy: { scheduledAt: "asc" },
      include: { teamA: true, teamB: true, tournament: true },
    }),
    prisma.tournamentPrize.findMany({
      where: { tournamentId: tournament.id },
      orderBy: { placeFrom: "asc" },
    }),
  ]);

  /**
   * Göstəriləcək komandalar.
   *
   * Kurasiya olunmuş TournamentParticipant sətirləri həmişə üstündür: onlar
   * seed və placement daşıyır, mükafat hesablaması da onlardan asılıdır.
   *
   * Cədvəl boş olanda siyahı MATÇLARDAN çıxarılır. Səbəb ölçüldü: 149 turnirdən
   * 111-inin iştirakçı sətri yox idi və bunların demək olar hamısı DAVAM EDƏN
   * turnirlərdir. Yəni səhifə «iştirakçılar hələ açıqlanmayıb» yazırdı, halbuki
   * elə aşağıda həmin komandaların oynadığı matçlar sadalanırdı — boş bölmə
   * deyil, açıq ziddiyyət.
   *
   * Data onsuz da bizdədir və `matches` yuxarıda komandaları ilə birlikdə
   * çəkilib, ona görə bunun əlavə sorğusu yoxdur.
   *
   * Cədvələ YAZILMIR. TournamentParticipant kurasiya üçündür; ora yazsaq həqiqi
   * mənbə ikiyə bölünər və yeni matç gələndə cədvəl köhnələrdi. Render zamanı
   * çıxarmaq həmişə cari qalır və admin sonradan həqiqi siyahını yazanda
   * avtomatik ona keçir.
   */
  const derivedTeams =
    participants.length > 0
      ? []
      : [...new Map(matches.flatMap((m) => [[m.teamAId, m.teamA], [m.teamBId, m.teamB]] as const)).values()]
          // Əlifba sırası qəsdəndir: sıralama heç bir reytinq bildirməməlidir.
          // Eyni mülahizə oyunçu cədvəlində də var (lib/playerTable.ts).
          .sort((a, b) => a.name.localeCompare(b.name));

  const dateFmt = siteFormat(locale, { dateStyle: "medium" });

  return (
    <PageShell>
      {/* Matç, komanda və oyunçu səhifələrində struktur data onsuz da vardı;
          turnir tək istisna idi. */}
      <JsonLd data={tournamentJsonLd(locale, tournament)} />
      <div className="mb-6 flex items-start gap-4 rounded-xl border border-border-subtle bg-surface p-6">
        {/* Loqo admin paneldən yüklənir; indiyə qədər heç yerdə göstərilmirdi.
            Yoxdursa blok tam əvvəlki kimi görünür. */}
        {tournament.logoUrl && (
          <Image
            src={tournament.logoUrl}
            alt=""
            width={56}
            height={56}
            unoptimized
            className="h-14 w-14 shrink-0 rounded-lg object-contain"
          />
        )}
        <div className="min-w-0 flex-1">
        <div className="mb-2 flex items-center gap-2">
          <GameChip name={tournament.game.shortName} color={tournament.game.accentColor} />
          <span className="text-xs text-foreground-muted">{locale === "az" ? "Tier" : "Tier"} {tournament.tier}</span>
        </div>
        <h1 className="font-display text-2xl font-bold">{tournament.name}</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          {dateFmt.format(tournament.startDate)} – {dateFmt.format(tournament.endDate)}
          {tournament.location ? ` · ${tournament.location}` : ""}
          {tournament.prizePool ? ` · ${tournament.prizePool}` : ""}
        </p>
        </div>
      </div>

      {prizes.length > 0 && (
        <>
          <h2 className="font-display mb-2 text-lg font-bold">
            {locale === "az" ? "Nəticələr və mükafat bölgüsü" : "Results and prize distribution"}
          </h2>
          <div className="mb-6 overflow-hidden rounded-lg border border-border-subtle bg-surface">
            {prizes.map((prize) => (
              <div
                key={prize.id}
                className="flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-2.5 last:border-b-0"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{placeRangeLabel(prize, locale)}</span>
                  {prize.label && <span className="block truncate text-xs text-foreground-muted">{prize.label}</span>}
                </span>
                <span className="shrink-0 font-display font-bold tabular-nums text-positive">
                  {formatMoney(prize.amount)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      <h2 className="font-display mb-2 text-lg font-bold">{t("nav.teams")}</h2>
      <div className="mb-6 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {participants.map((p) => {
          // Derived from the breakdown above rather than stored per team, so the
          // two can never disagree.
          const prize = prizeForPlacement(prizes, p.placement);
          return (
            <Link
              key={p.id}
              href={`/teams/${p.team.slug}`}
              className="flex items-center gap-2 rounded-lg border border-border-subtle bg-surface p-2 hover:bg-surface-raised"
            >
              {p.placement && (
                <span className="w-6 text-center text-xs font-semibold text-brand-via-fg">#{p.placement}</span>
              )}
              <TeamAvatar name={p.team.name} logoUrl={p.team.logoUrl} color={p.team.primaryColor} size={28} />
              <span className="min-w-0 flex-1 truncate text-sm">{p.team.name}</span>
              {prize != null && (
                <span className="shrink-0 text-xs tabular-nums text-positive">{formatMoney(prize)}</span>
              )}
            </Link>
          );
        })}
        {derivedTeams.map((team) => (
          // Çıxarılan komandada yer və mükafat YOXDUR — uydurma sıra nömrəsi
          // göstərilməməlidir. Yalnız kimin oynadığı bilinir.
          <Link
            key={team.id}
            href={`/teams/${team.slug}`}
            className="flex items-center gap-2 rounded-lg border border-border-subtle bg-surface p-2 hover:bg-surface-raised"
          >
            <TeamAvatar name={team.name} logoUrl={team.logoUrl} color={team.primaryColor} size={28} />
            <span className="min-w-0 flex-1 truncate text-sm">{team.name}</span>
          </Link>
        ))}
        {participants.length === 0 && derivedTeams.length === 0 && (
          <p className="text-sm text-foreground-muted">
            {/* Yalnız burada doğrudur: nə iştirakçı sətri var, nə də oynanmış matç. */}
            {locale === "az" ? "İştirakçılar hələ açıqlanmayıb." : "Participants have not been announced yet."}
          </p>
        )}
      </div>

      {(() => {
        /**
         * Səhifə iki hissədir: turnirin həll olunduğu pley-off, sonra ona
         * aparan hər şey.
         *
         * Pley-off yuxarıdadır, xronoloji sıraya baxmayaraq — səhifəyə girən
         * adam əvvəlcə kimin qazandığını görmək istəyir, seçmə mərhələsini yox.
         * Bölgü yalnız bracket olanda qurulur; LoL və VALORANT turnirlərinin
         * əksəriyyətində mərhələ məlum deyil və səhifə tək siyahı olaraq qalır.
         */
        const bracketMatches = matches.filter((m) => isBracketStage(m.stage));
        const otherMatches = matches.filter((m) => !isBracketStage(m.stage));
        const { playoff, earlier } = splitPlayoff(groupBrackets(bracketMatches));
        const hasEarlier = earlier.length > 0 || otherMatches.length > 0;

        return (
          <>
            {playoff && (
              <div className="mb-8">
                <h2 className="font-display mb-3 text-lg font-bold">
                  {locale === "az" ? "Pley-off" : "Playoffs"}
                </h2>
                {/* Bölmə başlığı onsuz da «Pley-off» yazır — bracket-in öz adını
                    təkrar etmək lazım deyil. */}
                <BracketList groups={[playoff]} locale={locale} showLabels={false} />
              </div>
            )}

            {playoff && hasEarlier && (
              <h2 className="font-display mb-3 text-lg font-bold">
                {locale === "az" ? "Pley-off öncəsi" : "Before the playoffs"}
              </h2>
            )}

            {earlier.length > 0 && (
              <div className="mb-6">
                <BracketList groups={earlier} locale={locale} />
              </div>
            )}

            {/* Başlıq yalnız altında nəsə olanda çəkilir. Bracket bütün
                matçları udanda — VCT mərhələlərində olduğu kimi, 12 matçın
                12-si — boş «Matçlar» başlığı qalırdı. */}
            {(otherMatches.length > 0 || matches.length === 0) && (
              <h2 className="font-display mb-2 text-lg font-bold">
                {playoff && hasEarlier
                  ? locale === "az"
                    ? "Digər matçlar"
                    : "Other matches"
                  : t("nav.matches")}
              </h2>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {otherMatches.map((match) => (
                <MatchCard key={match.id} match={match} />
              ))}
              {matches.length === 0 && (
                <p className="text-sm text-foreground-muted">
                  {locale === "az"
                    ? "Bu turnirin matçları hələ qeydə alınmayıb."
                    : "No matches recorded for this tournament yet."}
                </p>
              )}
            </div>
          </>
        );
      })()}
    </PageShell>
  );
}
