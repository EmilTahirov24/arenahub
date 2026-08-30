import { siteUrl } from "@/lib/siteUrl";
import { compact } from "@/components/seo/JsonLd";

/**
 * schema.org təsvirlərini quran funksiyalar.
 *
 * Prinsip birdir və saytın qalanı ilə eynidir: yalnız bildiyimizi yazırıq.
 * Naməlum sahə ötürülmür — `compact()` boş dəyərləri atır. schema.org-a uydurma
 * məlumat vermək səhifədə uydurma rəqəm göstərməkdən fərqlənmir, üstəlik
 * axtarış sistemi onu yoxlaya bilir.
 *
 * Yerin (`location`) qəsdən buraxıldığı hallar var: bir çox esports matçı
 * onlayn keçir və turnirin şəhəri qeyd olunmayıb. Yanlış yer yazmaqdansa
 * ümumiyyətlə yazmamaq düzgündür.
 */

function url(locale: string, path: string) {
  return `${siteUrl()}/${locale}${path}`;
}

type TeamLike = { name: string; slug: string; logoUrl?: string | null };

function teamNode(locale: string, team: TeamLike) {
  return compact({
    "@type": "SportsTeam",
    name: team.name,
    url: url(locale, `/teams/${team.slug}`),
    logo: team.logoUrl ?? undefined,
  });
}

export function matchJsonLd(
  locale: string,
  match: {
    slug: string;
    scheduledAt: Date;
    status: string;
    teamA: TeamLike;
    teamB: TeamLike;
    game: { name: string };
    tournament?: { name: string; slug: string; location?: string | null } | null;
  },
) {
  // schema.org-da "bitmiş" statusu yoxdur: EventStatusType yalnız planlaşdırılmış,
  // ləğv olunmuş, təxirə salınmış və vaxtı dəyişdirilmiş halları tanıyır. Ona görə
  // keçmiş matçlarda status ümumiyyətlə yazılmır — bitmiş qarşılaşmanı
  // "EventScheduled" adlandırmaq səhv olardı.
  const scheduled = match.status === "UPCOMING" || match.status === "LIVE";

  return compact({
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: `${match.teamA.name} vs ${match.teamB.name}`,
    url: url(locale, `/matches/${match.slug}`),
    startDate: match.scheduledAt.toISOString(),
    sport: match.game.name,
    eventStatus: scheduled ? "https://schema.org/EventScheduled" : undefined,
    competitor: [teamNode(locale, match.teamA), teamNode(locale, match.teamB)],
    superEvent: match.tournament
      ? compact({
          "@type": "SportsEvent",
          name: match.tournament.name,
          url: url(locale, `/events/${match.tournament.slug}`),
        })
      : undefined,
    location: match.tournament?.location
      ? { "@type": "Place", name: match.tournament.location }
      : undefined,
  });
}

export function teamJsonLd(
  locale: string,
  team: {
    name: string;
    slug: string;
    logoUrl?: string | null;
    description?: string | null;
    foundedAt?: Date | null;
    game: { name: string };
  },
) {
  return compact({
    "@context": "https://schema.org",
    "@type": "SportsTeam",
    name: team.name,
    url: url(locale, `/teams/${team.slug}`),
    logo: team.logoUrl ?? undefined,
    description: team.description ?? undefined,
    sport: team.game.name,
    foundingDate: team.foundedAt ? team.foundedAt.toISOString().slice(0, 10) : undefined,
  });
}

export function playerJsonLd(
  locale: string,
  player: {
    nickname: string;
    slug: string;
    firstName?: string | null;
    lastName?: string | null;
    photoUrl?: string | null;
    country?: string | null;
  },
  team?: TeamLike | null,
) {
  // Əsl ad yalnız hər iki hissəsi bilinəndə yazılır: "Emil" tək başına
  // alternateName kimi faydasızdır və yarımçıq məlumatdır.
  const realName =
    player.firstName && player.lastName ? `${player.firstName} ${player.lastName}` : undefined;

  return compact({
    "@context": "https://schema.org",
    "@type": "Person",
    name: player.nickname,
    alternateName: realName,
    url: url(locale, `/players/${player.slug}`),
    image: player.photoUrl ?? undefined,
    nationality: player.country ?? undefined,
    memberOf: team ? teamNode(locale, team) : undefined,
  });
}

export function siteJsonLd(locale: string) {
  const base = siteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "ArenaHub",
    url: `${base}/${locale}`,
    inLanguage: locale,
    publisher: {
      "@type": "Organization",
      name: "ArenaHub",
      url: base,
    },
  };
}

export function tournamentJsonLd(
  locale: string,
  tournament: {
    name: string;
    slug: string;
    startDate: Date;
    endDate: Date;
    status: string;
    location?: string | null;
    logoUrl?: string | null;
    game: { name: string };
  },
) {
  // Matç səhifəsindəki qayda burada da tətbiq olunur: schema.org-un
  // `EventStatusType`-ında «bitmiş» yoxdur, ona görə keçmiş turnirdə status
  // ümumiyyətlə yazılmır. Bitmiş turniri «EventScheduled» adlandırmaq səhv
  // olardı.
  const scheduled = tournament.status === "UPCOMING" || tournament.status === "ONGOING";

  return compact({
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: tournament.name,
    url: url(locale, `/events/${tournament.slug}`),
    startDate: tournament.startDate.toISOString(),
    endDate: tournament.endDate.toISOString(),
    sport: tournament.game.name,
    image: tournament.logoUrl ?? undefined,
    eventStatus: scheduled ? "https://schema.org/EventScheduled" : undefined,
    // Yer bilinməyəndə yazılmır — bir çox turnir onlayn keçir və yanlış şəhər
    // yazmaqdansa sahəni buraxmaq düzgündür.
    location: tournament.location
      ? { "@type": "Place", name: tournament.location }
      : undefined,
  });
}

export function articleJsonLd(
  locale: string,
  article: {
    slug: string;
    title: string;
    excerpt?: string | null;
    publishedAt?: Date | null;
    updatedAt?: Date | null;
    coverImageUrl?: string | null;
    authorName?: string | null;
  },
) {
  return compact({
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title,
    url: url(locale, `/news/${article.slug}`),
    description: article.excerpt ?? undefined,
    datePublished: article.publishedAt ? article.publishedAt.toISOString() : undefined,
    dateModified: article.updatedAt ? article.updatedAt.toISOString() : undefined,
    image: article.coverImageUrl ?? undefined,
    inLanguage: locale,
    // Müəllif adı bilinəndə yazılır. Həftəlik icmalların müəllifi admin
    // hesabıdır və bu, doğru məlumatdır — uydurma imza qoyulmur.
    author: article.authorName ? { "@type": "Person", name: article.authorName } : undefined,
    publisher: { "@type": "Organization", name: "ArenaHub", url: siteUrl() },
  });
}
