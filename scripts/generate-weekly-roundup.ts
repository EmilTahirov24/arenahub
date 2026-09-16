/**
 * Writes one weekly results roundup from matches already in our database.
 *
 *   npx tsx scripts/generate-weekly-roundup.ts              # dry run, prints it
 *   npx tsx scripts/generate-weekly-roundup.ts --weeks 1    # which week back
 *   npx tsx scripts/generate-weekly-roundup.ts --apply
 *
 * Why this exists, and why it is not a news feed.
 *
 * The site has a news section and nothing in it. The obvious answer — pull
 * articles from an esports site — is not available: there is no licensed
 * esports news API. Checked in August 2026: GRID, PandaScore, Abios, SportBex
 * and Tachio all sell match data, not editorial text. HLTV has no public API at
 * all, and every "HLTV API" package is a scraper their Cloudflare rules block.
 *
 * That is not merely a technical wall. A match score is a fact and nobody owns
 * it, which is why the results here can come from Liquipedia under CC BY-SA. An
 * article is authored work, and copying it would be infringement whether or not
 * an endpoint existed.
 *
 * So this writes from what we already hold: who played, who won, in which
 * event. Nothing is invented — every sentence is assembled from rows in our own
 * database, and a week with no finished matches produces no article rather than
 * an empty one.
 *
 * Deliberately weekly. Generating an article per match would be scaled content
 * of exactly the kind search engines demote, and it would bury anything the
 * owner writes by hand. One factual summary a week sits beside human writing
 * instead of drowning it.
 *
 * Re-running the same week updates that week's article rather than adding a
 * second one — the slug carries the date range.
 *
 * Builds its own PrismaClient, like the other scripts: lib/* is "server-only"
 * and throws outside Next.
 */
import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

/** Tier order for picking what leads the summary. */
const TIER_RANK: Record<string, number> = { S: 0, A: 1, B: 2, C: 3 };

function arg(name: string, fallback: number) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? Number(process.argv[i + 1]) || fallback : fallback;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function main() {
  const apply = process.argv.includes("--apply");
  const weeksBack = arg("weeks", 1);

  // Monday to Sunday: the week boundary has to be fixed so that a repeat run
  // updates the same article rather than creating another one.
  const now = new Date();
  const day = (now.getUTCDay() + 6) % 7; // Monday = 0
  const thisMonday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day));
  const start = new Date(thisMonday.getTime() - weeksBack * 7 * 86_400_000);
  const end = new Date(start.getTime() + 7 * 86_400_000);

  const matches = await prisma.match.findMany({
    where: { status: "FINISHED", winnerId: { not: null }, scheduledAt: { gte: start, lt: end } },
    include: {
      teamA: { select: { name: true, slug: true } },
      teamB: { select: { name: true, slug: true } },
      game: { select: { name: true, shortName: true, slug: true } },
      tournament: { select: { name: true, slug: true, tier: true } },
    },
    orderBy: { scheduledAt: "asc" },
  });

  const last = new Date(end.getTime() - 1);
  const range = `${start.toISOString().slice(0, 10)} — ${last.toISOString().slice(0, 10)}`;

  // The last day shown in the label: the week's last FULL day, at UTC midnight.
  //
  // `last` is 23:59:59.999, and formatting that in the Baku zone pushed the day
  // forward by one - "27 July - 3 August" for a week that ends on 2 August.
  // The week boundaries are computed in UTC, so the label is written in UTC
  // too; the month name changes with the language, the day number does not.
  const labelEnd = new Date(start.getTime() + 6 * 86_400_000);

  /**
   * A human-readable range in the form "17-23 August". Across a month
   * boundary both months are written ("29 August - 4 September"), or the range
   * reads wrongly.
   */
  function weekLabel(locale: "az" | "en") {
    const tag = locale === "az" ? "az-AZ" : "en-GB";
    const d = (x: Date) => new Intl.DateTimeFormat(tag, { timeZone: "UTC", day: "numeric" }).format(x);
    const dm = (x: Date) =>
      new Intl.DateTimeFormat(tag, { timeZone: "UTC", day: "numeric", month: "long" }).format(x);
    const sameMonth = start.getUTCMonth() === labelEnd.getUTCMonth();
    return sameMonth ? `${d(start)}–${dm(labelEnd)}` : `${dm(start)} – ${dm(labelEnd)}`;
  }

  console.log(`week: ${range}`);
  console.log(`finished matches: ${matches.length}\n`);

  // No article is written for an empty week. An empty article is worse than none.
  if (matches.length === 0) {
    console.log("No matches finished this week - no article is written.");
    return;
  }

  // Grouped by tournament and ordered by tier and match count: the reader wants
  // the biggest event first.
  const byTournament = new Map<string, typeof matches>();
  for (const m of matches) {
    const key = m.tournament?.slug ?? "—";
    if (!byTournament.has(key)) byTournament.set(key, []);
    byTournament.get(key)!.push(m);
  }
  const groups = [...byTournament.values()].sort((a, b) => {
    const ta = TIER_RANK[a[0].tournament?.tier ?? "C"] ?? 9;
    const tb = TIER_RANK[b[0].tournament?.tier ?? "C"] ?? 9;
    return ta !== tb ? ta - tb : b.length - a.length;
  });

  const byGame = new Map<string, number>();
  for (const m of matches) byGame.set(m.game.shortName, (byGame.get(m.game.shortName) ?? 0) + 1);
  // The slugs of the games covered are written into the tags. They appear on
  // the card as coloured chips: the list used to be nine identical grey boxes
  // of text, and what had been played in which week was only apparent from
  // reading the summary. Nothing is invented - the tags are the games that
  // genuinely had matches that week, ordered by match count.
  const perSlug = new Map<string, number>();
  for (const m of matches) perSlug.set(m.game.slug, (perSlug.get(m.game.slug) ?? 0) + 1);
  const gameSlugs = [...perSlug.entries()].sort((a, b) => b[1] - a[1]).map(([slug]) => slug);
  const articleTags = ["nəticələr", ...gameSlugs];
  const gameLine = [...byGame.entries()].sort((a, b) => b[1] - a[1]).map(([g, n]) => `${g} ${n}`).join(", ");

  function body(locale: "az" | "en") {
    const az = locale === "az";
    const parts: string[] = [];
    parts.push(
      `<p>${az ? "Bu həftə" : "This week"} <strong>${matches.length}</strong> ${
        az ? "matç başa çatdı" : "matches finished"
      } — ${escapeHtml(gameLine)}.</p>`,
    );

    for (const group of groups.slice(0, 6)) {
      const t = group[0].tournament;
      const heading = t
        ? `<a href="/${locale}/events/${t.slug}">${escapeHtml(t.name)}</a>`
        : az
          ? "Turnirsiz matçlar"
          : "Matches without an event";
      parts.push(`<h3>${heading}</h3>`);

      const rows = group
        .slice(0, 8)
        .map((m) => {
          const a = escapeHtml(m.teamA.name);
          const b = escapeHtml(m.teamB.name);
          return `<li><a href="/${locale}/matches/${m.slug}">${a} ${m.teamAScore} : ${m.teamBScore} ${b}</a></li>`;
        })
        .join("");
      parts.push(`<ul>${rows}</ul>`);
      if (group.length > 8) {
        parts.push(
          `<p>${az ? `və daha ${group.length - 8} matç` : `and ${group.length - 8} more matches`}.</p>`,
        );
      }
    }

    parts.push(
      `<p><em>${
        az
          ? "Bu icmal saytdakı matç nəticələrindən avtomatik yığılıb. Mənbə: Liquipedia (CC BY-SA)."
          : "This roundup is assembled automatically from the results on this site. Source: Liquipedia (CC BY-SA)."
      }</em></p>`,
    );
    return parts.join("\n");
  }

  // The headline is written for a person, not a machine. It used to read
  // `2026-08-17 - 2026-08-23`: two such headlines side by side in a list were
  // indistinguishable and promised nothing. The month name is used now, and
  // the ISO date stays in the slug.
  const titleAz = `${weekLabel("az")}: həftənin nəticələri`;
  const titleEn = `${weekLabel("en")}: results of the week`;
  const slug = `hefte-neticeleri-${start.toISOString().slice(0, 10)}`;

  // The summary is the only text visible on the card - without it the card is
  // one line of headline. Nothing is invented here either: the match count, the
  // split by game and the highest-tier tournament are assembled from our own
  // rows.
  const lead = groups[0]?.[0]?.tournament;

  // The ordering looks at tier first and match count second. So in a week with
  // no high-tier tournament, the first group is simply the one with the MOST
  // MATCHES - usually a low-tier qualifier. On the live site that read:
  // "Biggest event: LGC/2026/Rising/Stage 4/Swiss Stage". The sentence was not
  // false, but it was not what it promised either.
  //
  // So the wording follows what was computed: "biggest event" where there is an
  // S or A tier, and "most matches" otherwise.
  const leadIsMajor = lead?.tier === "S" || lead?.tier === "A";

  function excerpt(locale: "az" | "en") {
    const az = locale === "az";
    const head = az
      ? `${matches.length} matç başa çatdı — ${gameLine}.`
      : `${matches.length} matches finished — ${gameLine}.`;
    if (!lead) return head;
    const label = leadIsMajor
      ? az
        ? "Ən böyük hadisə"
        : "Biggest event"
      : az
        ? "Ən çox matç"
        : "Most matches";
    return `${head} ${label}: ${lead.name}.`;
  }

  console.log("HEADLINE: " + titleAz);
  console.log("EXCERPT:  " + excerpt("az"));
  console.log("SLUG:    " + slug);
  console.log("");
  console.log(body("az").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 600) + "…");

  if (!apply) {
    console.log("\nNothing was written. Add --apply to write.");
    return;
  }

  const author = await prisma.adminUser.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
  if (!author) {
    console.log("\nThere is no admin user - an article needs an author.");
    return;
  }

  // The publication date is the end of the week COVERED, not the moment of
  // writing.
  //
  // This used to be `new Date()`, and the consequence was visible on the live
  // site: the round-up for 10-16 August sat there dated "28 August", because
  // the script had run again that day. Rewriting an old week presented it as
  // today's news and made the ordering a lie. For backfilling past weeks that
  // matters especially.
  //
  // It does not move into the future: run for the current week, the present
  // moment is used.
  const now2 = new Date();
  const publishedAt = last < now2 ? last : now2;

  const existing = await prisma.newsArticle.findUnique({ where: { slug }, select: { id: true } });
  const article = existing
    ? await prisma.newsArticle.update({
        where: { id: existing.id },
        // The tags are refreshed too: older articles carried only ["nəticələr"].
        data: { publishedAt, tags: articleTags },
        select: { id: true },
      })
    : await prisma.newsArticle.create({
        data: { slug, authorId: author.id, publishedAt, tags: articleTags },
        select: { id: true },
      });

  for (const [locale, title] of [
    ["az", titleAz],
    ["en", titleEn],
  ] as const) {
    await prisma.newsArticleTranslation.upsert({
      where: { articleId_locale: { articleId: article.id, locale } },
      create: { articleId: article.id, locale, title, excerpt: excerpt(locale), bodyHtml: body(locale) },
      update: { title, excerpt: excerpt(locale), bodyHtml: body(locale) },
    });
  }

  console.log(`\n${existing ? "Updated" : "Created"}: /news/${slug}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
