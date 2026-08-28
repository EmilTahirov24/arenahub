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

  // Bazar ertəsindən bazar gününə: həftə sərhədi sabit olmalıdır ki, təkrar
  // qaçış eyni məqaləni yeniləsin, yenisini yaratmasın.
  const now = new Date();
  const day = (now.getUTCDay() + 6) % 7; // bazar ertəsi = 0
  const thisMonday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day));
  const start = new Date(thisMonday.getTime() - weeksBack * 7 * 86_400_000);
  const end = new Date(start.getTime() + 7 * 86_400_000);

  const matches = await prisma.match.findMany({
    where: { status: "FINISHED", winnerId: { not: null }, scheduledAt: { gte: start, lt: end } },
    include: {
      teamA: { select: { name: true, slug: true } },
      teamB: { select: { name: true, slug: true } },
      game: { select: { name: true, shortName: true } },
      tournament: { select: { name: true, slug: true, tier: true } },
    },
    orderBy: { scheduledAt: "asc" },
  });

  const range = `${start.toISOString().slice(0, 10)} — ${new Date(end.getTime() - 1).toISOString().slice(0, 10)}`;
  console.log(`həftə: ${range}`);
  console.log(`bitmiş matç: ${matches.length}\n`);

  // Boş həftə üçün məqalə yazılmır. Boş məqalə heç nədən pisdir.
  if (matches.length === 0) {
    console.log("Bu həftədə bitmiş matç yoxdur — məqalə yazılmır.");
    return;
  }

  // Turnirə görə qruplaşdırıb, səviyyəyə və matç sayına görə sıralayırıq:
  // oxucuya əvvəlcə ən böyük hadisə lazımdır.
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

  const titleAz = `Həftənin nəticələri: ${range}`;
  const titleEn = `Results of the week: ${range}`;
  const slug = `hefte-neticeleri-${start.toISOString().slice(0, 10)}`;

  console.log("BAŞLIQ: " + titleAz);
  console.log("SLUG:   " + slug);
  console.log("");
  console.log(body("az").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 600) + "…");

  if (!apply) {
    console.log("\nHeç nə yazılmadı. Yazmaq üçün --apply əlavə et.");
    return;
  }

  const author = await prisma.adminUser.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
  if (!author) {
    console.log("\nAdmin istifadəçi yoxdur — məqaləyə müəllif lazımdır.");
    return;
  }

  const existing = await prisma.newsArticle.findUnique({ where: { slug }, select: { id: true } });
  const article = existing
    ? await prisma.newsArticle.update({
        where: { id: existing.id },
        data: { publishedAt: new Date() },
        select: { id: true },
      })
    : await prisma.newsArticle.create({
        data: { slug, authorId: author.id, publishedAt: new Date(), tags: ["nəticələr"] },
        select: { id: true },
      });

  for (const [locale, title] of [
    ["az", titleAz],
    ["en", titleEn],
  ] as const) {
    await prisma.newsArticleTranslation.upsert({
      where: { articleId_locale: { articleId: article.id, locale } },
      create: { articleId: article.id, locale, title, bodyHtml: body(locale) },
      update: { title, bodyHtml: body(locale) },
    });
  }

  console.log(`\n${existing ? "Yeniləndi" : "Yaradıldı"}: /news/${slug}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
