/**
 * Keeps upcoming, live and just-finished matches current.
 *
 *   npx tsx scripts/import-live.ts            # dry run
 *   npx tsx scripts/import-live.ts --apply
 *
 * Reads each wiki's own match list rather than individual tournament pages:
 * those only carry a schedule once the organiser publishes one, while this page
 * is generated from Liquipedia's match database and always has the near future
 * in it. Four pages, one `action=parse` each, so a pass takes about two minutes
 * at the rate their terms require.
 *
 * Designed to run every twenty minutes from CI. Matches are identified by who
 * played, in which event and when — never by list position — so repeating a run
 * updates rows in place and walks a match from UPCOMING to LIVE to FINISHED.
 *
 * Content is CC-BY-SA; the site credits Liquipedia in the footer.
 */
import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { fetchMatchTicker, type LiquipediaOptions, type ParsedMatch } from "../lib/liquipedia";
import { indexByOrg, orgKey } from "../lib/orgNames";
import { syncMaps } from "../lib/matchMaps";
import { recordImportRun } from "../lib/importRun";
import { WIKIS } from "../lib/wikis";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const USER_AGENT = "ArenaHub/0.1 (esports site; contact: emil.tahirov24@gmail.com)";

/**
 * How long a started-but-unfinished match stays LIVE.
 *
 * The wiki marks a match finished when someone edits it in, which can lag the
 * final round by hours. Without a ceiling those matches would sit on the live
 * page indefinitely, which is worse than showing nothing.
 */
const LIVE_WINDOW_MS = 6 * 60 * 60 * 1000;

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 70);
}

async function freeSlug(table: "team" | "tournament" | "match", base: string) {
  const root = slugify(base) || table;
  for (let i = 0; i < 30; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    const taken =
      table === "team"
        ? await prisma.team.findUnique({ where: { slug: candidate }, select: { id: true } })
        : table === "tournament"
          ? await prisma.tournament.findUnique({ where: { slug: candidate }, select: { id: true } })
          : await prisma.match.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!taken) return candidate;
  }
  return `${root}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Null means "do not write this one".
 *
 * A match whose start time has passed, that is not marked finished, and that is
 * older than the live window is simply unaccounted for — postponed, cancelled,
 * or just not edited in yet. Calling it UPCOMING would put a date from last
 * week in the fixtures list, which reads as a broken site; calling it POSTPONED
 * would be a claim the source never made. So it is left out until the wiki says
 * what happened.
 */
function statusOf(m: ParsedMatch, at: Date): "FINISHED" | "LIVE" | "UPCOMING" | null {
  if (m.played) return "FINISHED";
  if (!m.date) return null;
  const started = new Date(m.date).getTime();
  if (started > at.getTime()) return "UPCOMING";
  return at.getTime() - started < LIVE_WINDOW_MS ? "LIVE" : null;
}

async function main(): Promise<{ written: number; note: string }> {
  const apply = process.argv.includes("--apply");
  console.log(apply ? "REJIM: yazma (--apply)\n" : "REJIM: quru işlətmə — heç nə yazılmır\n");

  const now = new Date();
  let written = 0;
  let mapRows = 0;
  let swept = 0;
  let newTeams = 0;
  let newTournaments = 0;
  const problems: string[] = [];

  // Only wikis that answered get swept afterwards: a Liquipedia outage must not
  // be read as "every live match has gone away".
  const fetched: { slug: string; gameId: string }[] = [];

  for (const def of WIKIS) {
    const game = await prisma.game.findUnique({ where: { slug: def.slug } });
    if (!game) {
      problems.push(`Oyun tapılmadı: ${def.slug}`);
      continue;
    }

    const opts: LiquipediaOptions = { wiki: def.wiki, userAgent: USER_AGENT };
    let matches: ParsedMatch[];
    try {
      matches = await fetchMatchTicker(opts);
    } catch (e) {
      problems.push(`${def.slug}: portal oxunmadı — ${(e as Error).message}`);
      continue;
    }
    fetched.push({ slug: def.slug, gameId: game.id });

    // Undated matches cannot be placed on a calendar, a match against an
    // unnamed side is a bracket placeholder rather than a fixture, and
    // `statusOf` drops the ones whose outcome nobody has recorded.
    const usable = matches
      .filter((m) => m.date && m.teamA && m.teamB)
      .map((m) => ({ match: m, status: statusOf(m, now) }))
      .filter((x): x is { match: ParsedMatch; status: "FINISHED" | "LIVE" | "UPCOMING" } => x.status !== null);

    const counts = { FINISHED: 0, LIVE: 0, UPCOMING: 0 };
    for (const x of usable) counts[x.status]++;
    const dropped = matches.length - usable.length;

    console.log(
      `${def.slug.padEnd(9)} ${usable.length} matç — ` +
        `${counts.UPCOMING} qarşıda, ${counts.LIVE} canlı, ${counts.FINISHED} bitib` +
        (dropped > 0 ? `  (${dropped} naməlum, buraxıldı)` : ""),
    );

    if (!apply) {
      written += usable.length;
      for (const u of usable) if (u.status === "FINISHED") mapRows += u.match.maps.length;
      continue;
    }

    const teams = await prisma.team.findMany({ where: { gameId: game.id }, select: { id: true, name: true } });
    const { index: byOrg } = indexByOrg(teams);

    /** Finds a team, creating it from the wiki's own page title when new. */
    async function team(name: string) {
      const existing = byOrg.get(orgKey(name));
      if (existing) return existing;

      const created = await prisma.team.create({
        data: { slug: await freeSlug("team", `${def.slug}-${name}`), name, gameId: game!.id },
      });
      // Remembered immediately so two matches naming the same new team in one
      // pass do not create it twice.
      byOrg.set(orgKey(name), { id: created.id, name: created.name });
      newTeams++;
      return { id: created.id, name: created.name };
    }

    const tournamentCache = new Map<string, string | null>();

    /** Attaches the match to its event, creating a stub if we do not have it. */
    async function tournament(name: string | null | undefined, when: Date) {
      if (!name) return null;
      const cached = tournamentCache.get(name);
      if (cached !== undefined) return cached;

      const found = await prisma.tournament.findFirst({ where: { gameId: game!.id, name } });
      if (found) {
        tournamentCache.set(name, found.id);
        return found.id;
      }

      // Enough to group the match under a real name and give it a page. The
      // full tournament importer fills in dates, prizes and tier later.
      const created = await prisma.tournament.create({
        data: {
          slug: await freeSlug("tournament", `${def.slug}-${name}`),
          name,
          startDate: when,
          endDate: when,
          status: "ONGOING",
          tier: "C",
          gameId: game!.id,
        },
      });
      tournamentCache.set(name, created.id);
      newTournaments++;
      return created.id;
    }

    for (const { match: m, status } of usable) {
      const a = await team(m.teamA);
      const b = await team(m.teamB);
      if (a.id === b.id) continue;

      const scheduledAt = new Date(m.date!);
      const tournamentId = await tournament(m.tournament, scheduledAt);
      const winnerId = status === "FINISHED" ? (m.winner === 1 ? a.id : m.winner === 2 ? b.id : null) : null;

      const data = {
        scheduledAt,
        status,
        bestOf: m.bestOf ?? (m.played ? Math.max(1, Math.max(m.scoreA, m.scoreB) * 2 - 1) : 3),
        teamAScore: m.scoreA,
        teamBScore: m.scoreB,
        teamAId: a.id,
        teamBId: b.id,
        winnerId,
        tournamentId,
        gameId: game.id,
      };

      const existing = await prisma.match.findFirst({
        where: { gameId: game.id, teamAId: a.id, teamBId: b.id, scheduledAt },
        select: { id: true },
      });

      let matchId: string;
      if (existing) {
        await prisma.match.update({ where: { id: existing.id }, data });
        matchId = existing.id;
      } else {
        const created = await prisma.match.create({
          data: { slug: await freeSlug("match", `${def.slug}-${a.name}-vs-${b.name}-${m.date!.slice(0, 10)}`), ...data },
          select: { id: true },
        });
        matchId = created.id;
      }
      written++;

      // The wiki-wide list gives a series score and no map breakdown, so this
      // is almost always skipped — scripts/import-maps.ts reads the tournament
      // pages, which do carry them. It stays because the parser fills `maps`
      // whenever a block happens to include them, and dropping data we already
      // hold on the floor is how the map list came to be empty in the first
      // place.
      //
      // Finished series only. A live one changes between passes and the wiki
      // lags the real score, so a half-written map list would be wrong more
      // often than absent — and the sweep below spares any match carrying maps,
      // so writing them mid-series would make an abandoned match permanent.
      if (status === "FINISHED" && m.maps.length > 0) {
        mapRows += await syncMaps(prisma, matchId, m.maps, a.id, b.id);
      }
    }
  }

  // A match can drop off the ticker while still marked LIVE: the wiki stops
  // listing it before anyone records who won. Nothing in the loop above will
  // ever see it again, so it would sit on the live page for good — which is how
  // two League games from one morning were still "live" seven hours later. The
  // twenty-minute schedule does not help; only something that looks at what the
  // ticker *stopped* saying does.
  //
  // There is no result to write and inventing one is out of the question, so the
  // placeholder is removed. Anything carrying maps, statistics or a prediction
  // is somebody's work and stays put. Liquipedia publishing the result later
  // simply recreates the row.
  const cutoff = new Date(now.getTime() - LIVE_WINDOW_MS);
  for (const { slug, gameId } of fetched) {
    const abandoned = await prisma.match.findMany({
      where: { gameId, status: { in: ["LIVE", "UPCOMING"] }, scheduledAt: { lt: cutoff } },
      select: {
        id: true,
        scheduledAt: true,
        teamA: { select: { name: true } },
        teamB: { select: { name: true } },
        _count: { select: { maps: true, playerStats: true, predictions: true } },
      },
    });
    const removable = abandoned.filter(
      (m) => m._count.maps === 0 && m._count.playerStats === 0 && m._count.predictions === 0,
    );

    for (const m of removable) {
      console.log(
        `${slug.padEnd(9)} tərk edilmiş: ${m.teamA.name} vs ${m.teamB.name} — ${m.scheduledAt.toISOString().slice(0, 16)}`,
      );
    }
    if (apply && removable.length) {
      await prisma.match.deleteMany({ where: { id: { in: removable.map((m) => m.id) } } });
    }
    swept += removable.length;
  }

  console.log(
    `\n${written} matç` +
      (apply ? ` yazıldı, ${newTeams} yeni komanda, ${newTournaments} yeni turnir.` : " tapıldı."),
  );
  if (mapRows) console.log(`${mapRows} xəritə ${apply ? "yazıldı" : "tapıldı"}.`);
  if (swept) console.log(`${swept} tərk edilmiş matç ${apply ? "silindi" : "silinəcək"}.`);
  if (problems.length) console.log(`\nProblemlər:\n  ` + problems.join("\n  "));
  if (!apply) console.log("\nTətbiq etmək üçün: --apply");

  return {
    written,
    note:
      `${written} matç, ${mapRows} xəritə, ${swept} təmizləmə` +
      (problems.length ? `; ${problems.length} problem` : ""),
  };
}

// Qeyd yalnız --apply ilə yazılır: quru işlətmə lokal yoxlamadır və sağlamlıq
// tarixçəsini korlamamalıdır.
(process.argv.includes("--apply") ? recordImportRun(prisma, "import-live", main) : main())
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
