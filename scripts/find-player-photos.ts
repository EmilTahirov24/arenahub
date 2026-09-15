/**
 * Finds freely licensed player photos on Wikimedia Commons, via Wikidata.
 *
 *   npx tsx scripts/find-player-photos.ts               # everyone
 *   npx tsx scripts/find-player-photos.ts --limit 50
 *   npx tsx scripts/find-player-photos.ts --game cs2
 *
 * Writes `data/player-photo-candidates.json` and NOTHING else. Nothing reaches
 * the database or the site until a person has looked at each picture and moved
 * it into `data/player-photos.json` — see the note on verification below.
 *
 * Why not Liquipedia. Their player photos are event photographs and they publish
 * no licence for them: the API returns empty `extmetadata`, the file description
 * pages are empty, and their own editor note reads "the copyright holder of the
 * picture needs to send the picture and permission to use it to
 * photos@liquipedia.net". That permission is granted to Liquipedia, not to us.
 * Team logos are a different case and the reasoning is written out in
 * scripts/fetch-team-logos.ts: a logo is a trademark used to identify the team
 * it belongs to. A photograph is an authored work, and that reasoning does not
 * carry over.
 *
 * Why Wikidata rather than a Commons text search. A text search matches strings,
 * and esports handles are ordinary words. Measured on 2026-08-31, searching
 * Commons for "donk" returned a photograph of a church in the Netherlands, and
 * "Yatoro" returned an unrelated Japanese man. Attaching either to a real player
 * would be a fabricated claim about a living person.
 *
 * Wikidata answers a different question: it holds an entity for the PERSON, and
 * `P18` is that person's picture. There is no string matching left to get wrong
 * once the right entity is identified — so all the care goes into identifying it:
 *
 *   1. the entity's description must read as esports ("Danish esports player")
 *   2. where we know the player's country, Wikidata's must agree
 *   3. the file's licence must actually permit reuse
 *
 * Those three rejected "donk" (Dutch mycologist), "Caps" (a genus of plants) and
 * "TenZ" (a character in The Legend of Korra) on their own in testing.
 */
import "dotenv/config";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const USER_AGENT = "ArenaHub/0.1 (esports site; contact: emil.tahirov24@gmail.com)";
const OUT = path.join(process.cwd(), "data", "player-photo-candidates.json");

/** Wikimedia asks for a descriptive agent and unhurried access; 300ms is polite. */
const GAP_MS = 300;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function wiki(host: string, params: Record<string, string>) {
  await sleep(GAP_MS);
  const url = `https://${host}/w/api.php?${new URLSearchParams({ format: "json", formatversion: "2", ...params })}`;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`${host} ${res.status}`);
  return res.json();
}

/**
 * An entity is only considered when its own description says it is an esports
 * player. This is the gate that keeps mycologists and cartoon characters out,
 * and it is deliberately narrow: a description that says nothing recognisable
 * is treated as no match rather than as a maybe.
 */
const ESPORTS = /\b(esports?|e-sports?|electronic sports?|pro(fessional)? gamer|counter-?strike|league of legends|dota|valorant|csgo|cs:go)\b/i;

/** Licences that permit reuse with attribution. Anything else is not used. */
const FREE_LICENCE = /^(cc[ -]by([ -]sa)?([ -]\d(\.\d)?)?|cc0|public domain|pd)/i;

/**
 * Events whose name in a file title ties the picture to esports.
 *
 * Used only by the second pass (`--commons`), which searches Commons for a
 * player's REAL name. That pass is far less safe than Wikidata and needs its
 * own gate — see `commonsPass`.
 */
const EVENT =
  /\b(iem|esl|blast|pgl|dreamhack|lck|lec|lpl|lcs|vct|csgo|cs:go|the international|valorant champions|e-?sports?)\b/i;

/**
 * Minimum handle length for the "the file title names the player" test.
 *
 * Measured: the handle "33" matched the file `20190407 103310-COLLAGE.jpg`,
 * because the number sits inside the string. A short handle is not proof.
 */
const MIN_HANDLE = 3;

/** Whether the handle appears in the file name as a WORD OF ITS OWN. */
function titleNamesPlayer(title: string, nickname: string): boolean {
  if (nickname.length < MIN_HANDLE) return false;
  const safe = nickname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${safe}([^a-z0-9]|$)`, "i").test(title);
}

type Candidate = {
  slug: string;
  nickname: string;
  game: string;
  ourCountry: string | null;
  entity: string;
  description: string;
  wikidataCountry: string | null;
  countryAgrees: boolean | null;
  file: string;
  license: string;
  author: string;
  source: string;
  width: number;
  height: number;
  imageUrl: string;
  /** How it was found - which matters when somebody reviews it. */
  via: "wikidata" | "commons-realname";
};

/**
 * Second pass: search Commons for the player's real name.
 *
 * Wikidata is the safe route and it is exhausted — a deeper search (limit 20
 * instead of 5) over the top-20 teams' rosters found zero additional pictures.
 * The players who remain simply have no Wikidata item.
 *
 * A real name is much less ambiguous than a handle ("Dan Madesclaire" against
 * "donk"), but on its own it is still not enough. Measured on the first 70
 * players: 16 hits, and NINE of them were wrong — a 1941 portrait of a Czech
 * actor, a micrograph of a cyanobacterium, a football stadium, a butterfly, a
 * US Marines training photo.
 *
 * So a name match alone is not accepted as evidence. The file's own title must
 * also tie it to this player: either it contains the handle, or it names an
 * esports event. That gate keeps apEX ("ApEX IEM Chicago...") and XANTARES
 * ("Xantares in 2020") and rejects all nine wrong ones. Some correct pictures
 * are lost with it, and that is the right way round — every candidate still
 * goes to a person to look at afterwards.
 */
async function commonsPass(
  players: { slug: string; nickname: string; country: string | null; firstName: string | null; lastName: string | null; game: { slug: string } }[],
): Promise<Candidate[]> {
  const out: Candidate[] = [];
  for (const p of players) {
    if (!p.firstName || !p.lastName) continue;
    const real = `${p.firstName} ${p.lastName}`;
    let hits: { title: string }[] = [];
    try {
      const s = await wiki("commons.wikimedia.org", {
        action: "query",
        list: "search",
        srsearch: `"${real}" filetype:bitmap`,
        srnamespace: "6",
        srlimit: "4",
      });
      hits = s?.query?.search ?? [];
    } catch {
      continue;
    }
    // The name alone is not proof: the file name has to name the handle or the event.
    const usable = hits.filter(
      (h) => titleNamesPlayer(h.title, p.nickname) || EVENT.test(h.title),
    );
    if (!usable.length) continue;

    const info = await wiki("commons.wikimedia.org", {
      action: "query",
      titles: usable.map((h) => h.title).join("|"),
      prop: "imageinfo",
      iiprop: "extmetadata|url|size",
    });
    for (const pg of info?.query?.pages ?? []) {
      const ii = pg?.imageinfo?.[0];
      if (!ii) continue;
      const text = (k: string) =>
        ((ii.extmetadata ?? {})[k]?.value ?? "").toString().replace(/<[^>]*>/g, "").trim();
      const license = text("LicenseShortName");
      if (!FREE_LICENCE.test(license)) continue;
      out.push({
        slug: p.slug,
        nickname: p.nickname,
        game: p.game.slug,
        ourCountry: p.country,
        entity: "—",
        description: `Commons axtarışı: «${real}»`,
        wikidataCountry: null,
        countryAgrees: null,
        file: pg.title,
        license,
        author: text("Artist") || "—",
        source: `https://commons.wikimedia.org/wiki/${encodeURIComponent(pg.title)}`,
        width: ii.width ?? 0,
        height: ii.height ?? 0,
        imageUrl: ii.url ?? "",
        via: "commons-realname",
      });
      break;
    }
  }
  return out;
}

async function main() {
  const limit = Number(arg("--limit")) || 0;
  const game = arg("--game");

  // Ordered by the team's rating rather than alphabetically. The reason is
  // practical: Wikidata holds only well-known players, and alphabetical order
  // puts the least known at the head of the list - in the first trial 2 of 40
  // were found. Starting from the membership also gives ORDER BY the team's
  // rating, which `player.findMany` cannot sort by across a nested relation.
  const memberships = await prisma.teamMembership.findMany({
    where: {
      leftAt: null,
      player: { photoUrl: null, ...(game ? { game: { slug: game } } : {}) },
    },
    select: {
      player: {
        select: {
          slug: true,
          nickname: true,
          country: true,
          firstName: true,
          lastName: true,
          game: { select: { slug: true } },
        },
      },
    },
    orderBy: { team: { rating: "desc" } },
    ...(limit ? { take: limit } : {}),
  });

  // A player can appear on two teams; the first (highest rated) is the one kept.
  const seen = new Set<string>();
  const players = memberships
    .map((m) => m.player)
    .filter((p) => (seen.has(p.slug) ? false : (seen.add(p.slug), true)));

  console.log(`${players.length} oyunçu yoxlanılır (fotosuz, aktiv rosterdə)\n`);

  // 1. Candidate entities for each handle.
  const searches = new Map<string, string[]>();
  let n = 0;
  for (const p of players) {
    n++;
    if (n % 50 === 0) console.log(`   ...${n}/${players.length}`);
    const ids = new Set<string>();
    // Both the handle and, where known, the real name: some players are
    // recorded in Wikidata under their passport name only.
    const queries = [p.nickname];
    if (p.firstName && p.lastName) queries.push(`${p.firstName} ${p.lastName}`);
    for (const q of queries) {
      try {
        const s = await wiki("www.wikidata.org", {
          action: "wbsearchentities",
          search: q,
          language: "en",
          uselang: "en",
          limit: "5",
          type: "item",
        });
        for (const hit of s?.search ?? []) ids.add(hit.id);
      } catch {
        /* one failed request does not stop the whole run */
      }
    }
    if (ids.size) searches.set(p.slug, [...ids]);
  }

  // 2. The entities themselves, in batches of 50.
  const allIds = [...new Set([...searches.values()].flat())];
  console.log(`\n${allIds.length} namizəd qeyd oxunur...`);
  const entities = new Map<string, Record<string, unknown>>();
  for (let i = 0; i < allIds.length; i += 50) {
    const e = await wiki("www.wikidata.org", {
      action: "wbgetentities",
      ids: allIds.slice(i, i + 50).join("|"),
      props: "claims|descriptions|labels|aliases",
      languages: "en",
    });
    for (const [id, ent] of Object.entries(e?.entities ?? {})) {
      entities.set(id, ent as Record<string, unknown>);
    }
  }

  // 3. Country codes (P27 -> P297) in one batch.
  const countryIds = new Set<string>();
  for (const ent of entities.values()) {
    const c = claim(ent, "P27");
    if (typeof c === "object" && c && "id" in c) countryIds.add((c as { id: string }).id);
  }
  const countryCode = new Map<string, string>();
  const cl = [...countryIds];
  for (let i = 0; i < cl.length; i += 50) {
    const e = await wiki("www.wikidata.org", {
      action: "wbgetentities",
      ids: cl.slice(i, i + 50).join("|"),
      props: "claims",
    });
    for (const [id, ent] of Object.entries(e?.entities ?? {})) {
      const code = claim(ent as Record<string, unknown>, "P297");
      if (typeof code === "string") countryCode.set(id, code.toUpperCase());
    }
  }

  // 4. Pick the entity that matches.
  const picks: { player: (typeof players)[number]; id: string; ent: Record<string, unknown> }[] = [];
  for (const p of players) {
    for (const id of searches.get(p.slug) ?? []) {
      const ent = entities.get(id);
      if (!ent) continue;
      const desc = describe(ent);
      if (!ESPORTS.test(desc)) continue;

      // The handle has to appear among the entity's name or aliases - even
      // where the description fits, another player's entity must not be picked.
      const names = nameSet(ent);
      if (!names.has(p.nickname.toLowerCase())) {
        const real = `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim().toLowerCase();
        if (!real || !names.has(real)) continue;
      }
      picks.push({ player: p, id, ent });
      break;
    }
  }
  console.log(`${picks.length} oyunçu üçün esports qeydi tapıldı`);

  // 5. P18 and the Commons licence.
  const withImage = picks.filter((x) => typeof claim(x.ent, "P18") === "string");
  console.log(`${withImage.length}-də şəkil (P18) var\n`);

  const files = [...new Set(withImage.map((x) => `File:${claim(x.ent, "P18") as string}`))];
  const meta = new Map<string, Record<string, { value: string }>>();
  const info = new Map<string, { url: string; width: number; height: number }>();
  for (let i = 0; i < files.length; i += 40) {
    const e = await wiki("commons.wikimedia.org", {
      action: "query",
      titles: files.slice(i, i + 40).join("|"),
      prop: "imageinfo",
      iiprop: "extmetadata|url|size",
    });
    for (const pg of e?.query?.pages ?? []) {
      const ii = pg?.imageinfo?.[0];
      if (!ii) continue;
      meta.set(pg.title, ii.extmetadata ?? {});
      info.set(pg.title, { url: ii.url, width: ii.width, height: ii.height });
    }
  }

  const out: Candidate[] = [];
  const rejected: string[] = [];
  for (const x of withImage) {
    const title = `File:${claim(x.ent, "P18") as string}`;
    const m = meta.get(title) ?? {};
    const ii = info.get(title);
    const text = (k: string) => (m[k]?.value ?? "").toString().replace(/<[^>]*>/g, "").trim();
    const license = text("LicenseShortName");
    if (!FREE_LICENCE.test(license)) {
      rejected.push(`${x.player.nickname}: lisenziya «${license || "naməlum"}»`);
      continue;
    }
    const wdCountryId = claim(x.ent, "P27") as { id?: string } | undefined;
    const wdCountry = wdCountryId?.id ? (countryCode.get(wdCountryId.id) ?? null) : null;
    const agrees = x.player.country && wdCountry ? x.player.country.toUpperCase() === wdCountry : null;
    if (agrees === false) {
      rejected.push(`${x.player.nickname}: ölkə uyğun deyil (bizdə ${x.player.country}, Wikidata ${wdCountry})`);
      continue;
    }

    out.push({
      slug: x.player.slug,
      nickname: x.player.nickname,
      game: x.player.game.slug,
      ourCountry: x.player.country,
      entity: x.id,
      description: describe(x.ent),
      wikidataCountry: wdCountry,
      countryAgrees: agrees,
      file: title,
      license,
      author: text("Artist") || "—",
      source: `https://commons.wikimedia.org/wiki/${encodeURIComponent(title)}`,
      width: ii?.width ?? 0,
      height: ii?.height ?? 0,
      imageUrl: ii?.url ?? "",
      via: "wikidata",
    });
  }

  // A second source, only for the players Wikidata returned nothing for.
  if (process.argv.includes("--commons")) {
    const covered = new Set(out.map((c) => c.slug));
    const rest = players.filter((p) => !covered.has(p.slug));
    console.log(`
Commons (əsl ad) yoxlanılır: ${rest.length} oyunçu...`);
    out.push(...(await commonsPass(rest)));
  }

  out.sort((a, b) => a.nickname.localeCompare(b.nickname));
  await writeFile(OUT, JSON.stringify(out, null, 2) + "\n");

  console.log(`\n${out.length} NAMİZƏD — data/player-photo-candidates.json`);
  for (const c of out) {
    console.log(`  ${c.nickname.padEnd(16)} ${c.license.padEnd(14)} ${c.description.slice(0, 44)}`);
  }
  if (rejected.length) {
    console.log(`\n${rejected.length} rədd edildi:`);
    for (const r of rejected.slice(0, 20)) console.log(`  ${r}`);
  }
  console.log(
    `\nHEÇ BİRİ HƏLƏ İŞLƏNMİR. Hər şəkil gözlə yoxlanmalı və` +
      ` data/player-photos.json faylına köçürülməlidir.`,
  );
}

/**
 * The value after a flag, or undefined when the flag is absent.
 *
 * `argv[indexOf(flag) + 1]` will not do: with the flag absent `indexOf` gives
 * -1 and `argv[0]` returns node's own path. On the first run that turned the
 * game filter into `--game "C:\Program Files\nodejs\node.exe"` and returned
 * nothing.
 */
function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i === -1 ? undefined : process.argv[i + 1];
}

function claim(ent: Record<string, unknown>, prop: string): unknown {
  const claims = ent?.claims as Record<string, { mainsnak?: { datavalue?: { value?: unknown } } }[]> | undefined;
  return claims?.[prop]?.[0]?.mainsnak?.datavalue?.value;
}

function describe(ent: Record<string, unknown>): string {
  const d = ent?.descriptions as { en?: { value?: string } } | undefined;
  return d?.en?.value ?? "";
}

/** The entity's label and all its English aliases, lower-cased. */
function nameSet(ent: Record<string, unknown>): Set<string> {
  const out = new Set<string>();
  const labels = ent?.labels as { en?: { value?: string } } | undefined;
  if (labels?.en?.value) out.add(labels.en.value.toLowerCase());
  const aliases = ent?.aliases as { en?: { value: string }[] } | undefined;
  for (const a of aliases?.en ?? []) out.add(a.value.toLowerCase());
  return out;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
