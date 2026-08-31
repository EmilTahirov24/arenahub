/**
 * Finds freely licensed player photos on Wikimedia Commons, via Wikidata.
 *
 *   npx tsx scripts/find-player-photos.ts               # hamısı
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
};

async function main() {
  const limit = Number(arg("--limit")) || 0;
  const game = arg("--game");

  // Sıra komandanın reytinqinə görədir, əlifbaya görə yox. Səbəb praktikdir:
  // Wikidata yalnız tanınmış oyunçuları saxlayır, əlifba sırası isə siyahının
  // başına ən az tanınanları qoyur — ilk sınaqda 40 nəfərdən 2-si tapıldı.
  // Üzvlükdən başlamaq eyni zamanda ORDER BY-a komandanın reytinqini verir,
  // `player.findMany` isə iç-içə əlaqəyə görə sıralaya bilmir.
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

  // Bir oyunçu iki komandada görünə bilər; birincisi (ən yüksək reytinq) qalır.
  const seen = new Set<string>();
  const players = memberships
    .map((m) => m.player)
    .filter((p) => (seen.has(p.slug) ? false : (seen.add(p.slug), true)));

  console.log(`${players.length} oyunçu yoxlanılır (fotosuz, aktiv rosterdə)\n`);

  // 1. Hər ləqəb üçün namizəd qeydlər.
  const searches = new Map<string, string[]>();
  let n = 0;
  for (const p of players) {
    n++;
    if (n % 50 === 0) console.log(`   ...${n}/${players.length}`);
    const ids = new Set<string>();
    // Həm ləqəb, həm də bilinirsə əsl ad: bəzi oyunçular Wikidata-da yalnız
    // pasport adı ilə qeyd olunub.
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
        /* bir sorğunun uğursuzluğu bütün qaçışı dayandırmır */
      }
    }
    if (ids.size) searches.set(p.slug, [...ids]);
  }

  // 2. Qeydlərin özləri, 50-lik dəstələrlə.
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

  // 3. Ölkə kodları (P27 -> P297) bir dəstədə.
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

  // 4. Uyğun gələn qeydi seç.
  const picks: { player: (typeof players)[number]; id: string; ent: Record<string, unknown> }[] = [];
  for (const p of players) {
    for (const id of searches.get(p.slug) ?? []) {
      const ent = entities.get(id);
      if (!ent) continue;
      const desc = describe(ent);
      if (!ESPORTS.test(desc)) continue;

      // Ləqəb qeydin adı və ya təxəllüsləri arasında olmalıdır — təsvir uyğun
      // gəlsə də, başqa oyunçunun qeydi seçilməməlidir.
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

  // 5. P18 və Commons lisenziyası.
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
    });
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
 * Bayraqdan sonrakı dəyər, bayraq yoxdursa undefined.
 *
 * `argv[indexOf(flag) + 1]` yazmaq olmaz: bayraq yoxdursa `indexOf` -1 verir və
 * `argv[0]` node-un öz yolunu qaytarır. İlk qaçışda oyun filtri məhz buna görə
 * `--game "C:\Program Files\nodejs\node.exe"` oldu və sıfır nəticə verdi.
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

/** Qeydin adı və bütün ingilis təxəllüsləri, kiçik hərflə. */
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
