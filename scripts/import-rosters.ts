/**
 * Imports CS2 team rosters from Liquipedia: nicknames, nationalities, real names
 * and IGL roles.
 *
 *   npx tsx scripts/import-rosters.ts            # show what would change
 *   npx tsx scripts/import-rosters.ts --apply    # write it
 *
 * Dry run by default: this rewrites rosters for real organisations, so the
 * changes are worth reading before they land.
 *
 * Liquipedia content is CC-BY-SA and the site credits it in the footer. Their
 * rate limit means roughly 2.5s per team, so a full run takes about a minute.
 *
 * Builds its own PrismaClient rather than importing lib/prisma, the same way
 * prisma/seed.ts does — lib/* is "server-only" and throws outside Next.
 */
import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { fetchWikitext, parseActiveSquad, splitName, type LiquipediaOptions } from "../lib/liquipedia";
import { COUNTRIES } from "../lib/countries";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const OPTS: LiquipediaOptions = {
  wiki: "counterstrike",
  userAgent: "ArenaHub/0.1 (esports site; contact: emil.tahirov24@gmail.com)",
};

/**
 * Our team name is not always the Liquipedia page title. Only the differences
 * are listed; everything else is looked up by its own name. Guessing with a
 * search would risk importing the wrong organisation's roster.
 */
const PAGE_TITLES: Record<string, string> = {
  Vitality: "Team Vitality",
  Falcons: "Team Falcons",
  Spirit: "Team Spirit",
  Liquid: "Team Liquid",
  FaZe: "FaZe Clan",
  G2: "G2 Esports",
  "9z": "9z Team",
  Aurora: "Aurora Gaming",
  paiN: "paiN Gaming",
  Nemesis: "Team Nemesis",
  BetBoom: "BetBoom Team",
};

const VALID_COUNTRY = new Set(COUNTRIES.map((c) => c.code));

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/** Player.slug is unique and drives the public URL, so pick one that is free. */
async function freeSlug(nickname: string) {
  const base = slugify(nickname) || "player";
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
    if (!(await prisma.player.findUnique({ where: { slug: candidate }, select: { id: true } }))) return candidate;
  }
  throw new Error(`Slug tapılmadı: ${nickname}`);
}

/** Liquipedia sometimes writes partial dates like "2026-01-??". */
function parseJoinDate(raw: string | null) {
  if (!raw) return new Date();
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

async function main() {
  const apply = process.argv.includes("--apply");
  console.log(apply ? "REJIM: yazma (--apply)\n" : "REJIM: quru işlətmə — heç nə yazılmır. Yazmaq üçün --apply\n");

  const game = await prisma.game.findUniqueOrThrow({ where: { slug: "cs2" } });
  const teams = await prisma.team.findMany({
    where: { gameId: game.id },
    include: { memberships: { where: { leftAt: null }, include: { player: true } } },
    orderBy: { name: "asc" },
  });

  let updatedPlayers = 0;
  let createdPlayers = 0;
  const notFound: string[] = [];
  const unmatched: string[] = [];

  for (const team of teams) {
    const title = PAGE_TITLES[team.name] ?? team.name;
    const wikitext = await fetchWikitext(OPTS, title);

    if (!wikitext) {
      notFound.push(`${team.name} (axtarılan səhifə: ${title})`);
      continue;
    }

    const squad = parseActiveSquad(wikitext);
    if (squad.length === 0) {
      unmatched.push(`${team.name} — səhifə var, aktiv tərkib tapılmadı`);
      continue;
    }

    console.log(`${team.name}  (${title})`);

    for (const member of squad) {
      const country = member.country && VALID_COUNTRY.has(member.country) ? member.country : null;
      const { firstName, lastName } = splitName(member.realName);

      const existing = team.memberships.find(
        (m) => m.player.nickname.toLowerCase() === member.nickname.toLowerCase(),
      );

      if (existing) {
        const changes: string[] = [];
        if (country && existing.player.country !== country) changes.push(`ölkə ${existing.player.country ?? "—"}→${country}`);
        if (firstName && existing.player.firstName !== firstName) changes.push("ad");
        if (member.role && existing.player.role !== member.role) changes.push(`rol→${member.role}`);
        if (changes.length === 0) {
          console.log(`   = ${member.nickname}`);
          continue;
        }
        console.log(`   ~ ${member.nickname}  ${changes.join(", ")}`);
        updatedPlayers++;
        if (apply) {
          await prisma.player.update({
            where: { id: existing.playerId },
            data: {
              country: country ?? existing.player.country,
              firstName: firstName ?? existing.player.firstName,
              lastName: lastName ?? existing.player.lastName,
              role: member.role ?? existing.player.role,
            },
          });
        }
      } else {
        // The same nickname can appear on two team pages after a transfer, and
        // this script has to survive being re-run, so reuse an existing player
        // instead of creating a second profile for the same person.
        const known = await prisma.player.findFirst({
          where: { gameId: game.id, nickname: { equals: member.nickname, mode: "insensitive" } },
        });

        console.log(`   ${known ? "→" : "+"} ${member.nickname}  ${country ?? "—"}  ${member.realName ?? ""}`);
        createdPlayers++;
        if (!apply) continue;

        const player =
          known ??
          (await prisma.player.create({
            data: {
              slug: await freeSlug(member.nickname),
              nickname: member.nickname,
              country,
              firstName,
              lastName,
              role: member.role,
              gameId: game.id,
            },
          }));

        if (known) {
          await prisma.player.update({
            where: { id: known.id },
            data: {
              country: country ?? known.country,
              firstName: firstName ?? known.firstName,
              lastName: lastName ?? known.lastName,
              role: member.role ?? known.role,
            },
          });
          // A player belongs to one active roster; close any other before adding.
          await prisma.teamMembership.updateMany({
            where: { playerId: known.id, leftAt: null, teamId: { not: team.id } },
            data: { leftAt: new Date() },
          });
          const already = await prisma.teamMembership.findFirst({
            where: { playerId: known.id, teamId: team.id, leftAt: null },
          });
          if (already) continue;
        }

        await prisma.teamMembership.create({
          data: {
            teamId: team.id,
            playerId: player.id,
            joinedAt: parseJoinDate(member.joinDate),
          },
        });
      }
    }
  }

  console.log(`\n${updatedPlayers} oyunçu yenilənəcək, ${createdPlayers} oyunçu yaradılacaq.`);
  if (notFound.length) console.log(`\nSəhifəsi tapılmayan (${notFound.length}):\n  ` + notFound.join("\n  "));
  if (unmatched.length) console.log(`\nTərkibi oxunmayan (${unmatched.length}):\n  ` + unmatched.join("\n  "));
  if (!apply) console.log("\nHeç nə yazılmadı. Tətbiq etmək üçün: npx tsx scripts/import-rosters.ts --apply");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
