import { siteUrl } from "@/lib/siteUrl";
import { compact } from "@/components/seo/JsonLd";

/**
 * The functions that build the schema.org descriptions.
 *
 * One rule, the same as everywhere else on the site: write only what is
 * known. An unknown field is not passed at all - `compact()` drops empty
 * values. Feeding schema.org invented data is no different from printing an
 * invented number on the page, and a search engine can check it.
 *
 * `location` is deliberately left out in places: many esports matches are
 * played online and the tournament has no city recorded. Saying nothing beats
 * saying the wrong place.
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
  // schema.org has no "finished" status: EventStatusType knows only scheduled,
  // cancelled, postponed and rescheduled. So a past match carries no status at
  // all - calling a finished fixture "EventScheduled" would simply be wrong.
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
  // The real name is written only when both halves are known: "Emil" on its
  // own is useless as an alternateName, and it is half a fact.
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
  // The rule from the match page applies here too: schema.org's
  // `EventStatusType` has no "finished", so a past tournament carries no
  // status at all. Calling a finished tournament "EventScheduled" would be
  // wrong.
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
    // Left out when the place is unknown - many tournaments are played online,
    // and dropping the field beats naming the wrong city.
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
    // Written when the author is known. The weekly round-ups are authored by
    // the admin account, which is the truth - no invented byline goes here.
    author: article.authorName ? { "@type": "Person", name: article.authorName } : undefined,
    publisher: { "@type": "Organization", name: "ArenaHub", url: siteUrl() },
  });
}
