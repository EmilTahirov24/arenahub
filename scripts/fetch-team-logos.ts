/**
 * Downloads team logos from Liquipedia into the repository.
 *
 *   npx tsx scripts/fetch-team-logos.ts            # dry run, shows what it found
 *   npx tsx scripts/fetch-team-logos.ts --apply    # writes public/teams/*.png
 *   npx tsx scripts/fetch-team-logos.ts --missing  # only teams with no file yet
 *
 * Why this touches no database. Setting Team.logoUrl needs the production
 * connection string, which is stored as a Vercel "Secret" and cannot be read
 * back out — not even by the owner. So the work is split in two: this half has
 * network access and writes files, and scripts/apply-team-logos.ts has database
 * access and writes rows. They meet at data/team-logos.json.
 *
 * Why the input list is a committed file rather than a query. The same reason:
 * picking "the top 20" requires the ratings, which live in that database. The
 * list in data/logo-teams.json was read off the live ranking page — our own
 * numbers, not a guess — and committing it means the choice is auditable
 * instead of being re-derived differently on every run.
 *
 * Which image. Liquipedia infoboxes carry `image` and `imagedark`. The site is
 * dark, so `imagedark` wins where it exists; many orgs only ship one file, and
 * `allmode` in the name means it works on either background.
 *
 * Rate. Page content is fetched with `action=query&prop=revisions`, which sits
 * in Liquipedia's 2s bucket, not the 30s bucket that `action=parse` uses. That
 * is a twelvefold difference and the reason this finishes in a minute rather
 * than ten. File URLs are resolved in one batched `imageinfo` call.
 *
 * Licensing, stated plainly: Liquipedia *text* is CC BY-SA and the footer
 * credits it. Team logos are trademarks and are not CC — they are used here to
 * identify the team they belong to, which is what every esports site does. The
 * files are copied to our own server rather than hotlinked, which is also what
 * Liquipedia's terms require.
 *
 * sharp comes in through Next rather than being a direct dependency. That is
 * fine for a tool that only ever runs on a developer machine, but it is the
 * reason for the explicit error below instead of a bare module-not-found.
 */
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { wikiForGame } from "../lib/wikis";

const USER_AGENT = "ArenaHub/0.1 (esports site; contact: emil.tahirov24@gmail.com)";

/**
 * Their documented floor for ordinary queries is one per 2s; 2.6s leaves room.
 * Global rather than per wiki: the limit is on the client, not the subdomain,
 * so four wikis in one run must still share one queue.
 */
const GAP_MS = 2600;
/** 32px avatars on lists, larger on team pages; 256 covers both on retina. */
const SIZE = 256;

const OUT_DIR = path.join(process.cwd(), "public", "teams");
const MANIFEST = path.join(process.cwd(), "data", "team-logos.json");
const INPUT = path.join(process.cwd(), "data", "logo-teams.json");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function api(wiki: string, params: Record<string, string>) {
  await sleep(GAP_MS);
  const base = `https://liquipedia.net/${wiki}/api.php`;
  const url = `${base}?${new URLSearchParams({ format: "json", formatversion: "2", ...params })}`;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, "Accept-Encoding": "gzip" } });
  if (!res.ok) throw new Error(`Liquipedia ${res.status} — ${url}`);
  return res.json();
}

/**
 * Logos only. Liquipedia uploads org logos as transparent PNG (or SVG); the
 * JPEGs on a team page are photographs — `Spirit at LanDaLan 3.jpg` is a shot
 * of five people at an event, not a mark. Accepting them put a crowd photo on
 * the second-ranked team in the first run of this script.
 */
const IMAGE_EXT = [".png", ".svg", ".webp"];

/**
 * Infobox image field, preferring the dark-background variant.
 *
 * Read line by line rather than with a regex. Infobox parameters are already
 * one per line, so this is the shape the data actually has — and it keeps the
 * whole function free of escapes, which is what broke the first attempt.
 */
function logoFileFrom(wikitext: string): { dark: string; light: string } | null {
  const values = new Map<string, string>();
  for (const line of wikitext.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(1, eq).trim().toLowerCase();
    // İlk dəyər qalır: infoboksdan sonra səhifədə eyni adlı sahələr təkrarlana bilir.
    if (!values.has(key)) values.set(key, trimmed.slice(eq + 1).trim());
  }

  // MediaWiki başlıqlarında alt xətt boşluqla eynidir və cavabda həmişə
  // boşluq kimi qayıdır. Burada normallaşdırılmasa, `PARIVISION_allmode.png`
  // sorğuda tapılır, amma nəticə açarı ilə uyğunlaşmır və loqo itir.
  const usable = (value: string | undefined) =>
    value && IMAGE_EXT.some((ext) => value.toLowerCase().endsWith(ext))
      ? value.split("_").join(" ")
      : null;

  // İKİ variant qaytarılır, biri yox.
  //
  // Əvvəl yalnız `imagedark` götürülürdü — «sayt qaranlıqdır» deyə. Nəticə
  // işıqlı temada ölçüldü (2026-08-31): 127 loqonun 58-i TAM AĞDIR, yəni ağ
  // kartda tamamilə görünmür, daha 31-i sərhəddədir. Yəni işıqlı temada
  // komandaların təxminən yarısının loqosu sadəcə yox idi.
  //
  // Liquipedia infoboksu hər ikisini saxlayır: `image` açıq fon, `imagedark`
  // tünd fon üçün. Yoxlanıldı — Spirit, Paper Rex, Tundra, Dplus, BRUTE:
  // beşinin də fərqli işıqlı variantı var. Yalnız bir fayl olanda (`allmode`)
  // ikisi eyni gəlir və bu, düzgündür: həmin loqo onsuz da hər fonda işləyir.
  const dark = usable(values.get("imagedark")) ?? usable(values.get("image"));
  const light = usable(values.get("image")) ?? usable(values.get("imagedark"));
  return dark && light ? { dark, light } : null;
}

const MODES = ["allmode", "darkmode", "lightmode"];

/**
 * Other filenames that plausibly hold the same logo in a squarer crop.
 *
 * Two rewrites, and the boundary between them is the whole point.
 *
 * Dropping "full" is safe. Liquipedia uses it for the full lockup — icon plus
 * wordmark — and the file without it is the same artwork's icon, from the same
 * upload. Swapping the mode suffix is safe for the same reason.
 *
 * Dropping the *year* is not, and this was measured rather than assumed. The
 * infobox gives `Team Vitality 2026 full darkmode.png`; `Team Vitality
 * allmode.png` also exists, is nicely square, and is their previous crest with
 * the crossed swords. Same for `G2 Esports allmode.png`. A stale logo is worse
 * than a wide one, so the year stays.
 *
 * `alternates` mode ailəsini saxlayır. Tünd variant axtarılanda işıqlı fayl
 * namizəd olmamalıdır və əksinə — yoxsa «kvadrata ən yaxın» seçimi tünd loqonu
 * işıqlı yuvaya qoyar və düzəltdiyimiz problem geri qayıdar. `allmode` hər iki
 * siyahıdadır, çünki o, tərifinə görə hər fonda işləyir.
 */
function variantsOf(file: string, alternates: string[] = ["allmode", "darkmode"]): string[] {
  const dot = file.lastIndexOf(".");
  const stem = dot < 0 ? file : file.slice(0, dot);
  const ext = dot < 0 ? ".png" : file.slice(dot);

  const stems = new Set([stem]);
  if (stem.includes(" full ")) stems.add(stem.replace(" full ", " "));
  if (stem.endsWith(" full")) stems.add(stem.slice(0, -" full".length));

  const out = new Set<string>();
  for (const s of stems) {
    out.add(s + ext);
    const mode = MODES.find((m) => s.endsWith(` ${m}`));
    if (!mode) continue;
    const head = s.slice(0, s.length - mode.length);
    for (const other of alternates) out.add(head + other + ext);
  }
  return [...out];
}

/**
 * `wikiTitle` is set only where our name is not the Liquipedia title, and each
 * one was checked by hand. Guessing is not an option here: "Spirit" and
 * "Aurora" are both real pages for *other* organisations, so a near-miss does
 * not fail — it silently fits a rival's logo to the team.
 */
type Team = { slug: string; name: string; game: string; wikiTitle?: string };

async function main() {
  const apply = process.argv.includes("--apply");
  const only = process.argv.indexOf("--game") >= 0 ? process.argv[process.argv.indexOf("--game") + 1] : null;
  const all: Team[] = JSON.parse(readFileSync(INPUT, "utf8"));
  const byGame = only ? all.filter((t) => t.game === only) : all;

  // `--missing`: faylı onsuz da olan komandanı atlayır.
  //
  // Siyahı böyüdükcə tam qaçış Liquipedia-nın 2.6 saniyəlik fasiləsinə görə
  // dəqiqələrlə çəkir, halbuki hər dəfə axtarılan bir neçə yeni addır. Bu bayraq
  // olmadan siyahıya bir komanda əlavə etmək bütün siyahını yenidən çəkmək
  // demək idi — praktikada bu, siyahını böyütməkdən çəkindirirdi.
  //
  // Standart davranış dəyişmir: bayraqsız hamısı yenilənir, çünki loqo dəyişən
  // komanda üçün yeganə yol budur.
  const missingOnly = process.argv.includes("--missing");
  const teams = missingOnly
    ? byGame.filter((t) => !existsSync(path.join(OUT_DIR, `${t.slug}.png`)))
    : byGame;

  console.log(`komanda: ${teams.length}${only ? ` (${only})` : ""}${apply ? "" : "  (QURU İŞLƏTMƏ)"}\n`);

  // 1. Hər komandanın infoboksundan fayl adı.
  const found: {
    slug: string;
    name: string;
    wiki: string;
    file: string;
    fileLight: string;
    title: string;
  }[] = [];
  for (const team of teams) {
    const wiki = wikiForGame(team.game);
    if (!wiki) {
      console.log(`!  ${team.name.padEnd(20)} tanınmayan oyun: ${team.game}`);
      continue;
    }
    let data;
    try {
      data = await api(wiki, {
        action: "query",
        prop: "revisions",
        rvprop: "content",
        rvslots: "main",
        titles: team.wikiTitle ?? team.name,
        redirects: "1",
      });
    } catch (e) {
      console.log(`!  ${team.name.padEnd(20)} ${(e as Error).message}`);
      continue;
    }
    const page = data?.query?.pages?.[0];
    const text: string | undefined = page?.revisions?.[0]?.slots?.main?.content;
    if (!text) {
      console.log(`—  ${team.name.padEnd(20)} səhifə yoxdur`);
      continue;
    }
    const file = logoFileFrom(text);
    if (!file) {
      console.log(`—  ${team.name.padEnd(20)} infoboksda şəkil yoxdur`);
      continue;
    }
    const sameFile = file.dark === file.light;
    console.log(`+  ${team.name.padEnd(20)} ${file.dark}${sameFile ? "" : `  |  işıqlı: ${file.light}`}`);
    found.push({
      slug: team.slug,
      name: team.name,
      wiki,
      file: file.dark,
      fileLight: file.light,
      title: page?.title ?? "",
    });
  }

  if (found.length === 0) {
    console.log("\nHeç bir loqo tapılmadı.");
    return;
  }

  /**
   * Report, but do not act on, two teams landing on one Liquipedia page.
   *
   * The first version dropped both, on the reasoning that one of them must be
   * wrong. Running it over four wikis showed that reasoning was too narrow.
   * There are two quite different causes and only one is a fault:
   *
   *   G2 Gozen and G2 Esports both resolve to G2's page, as do Gentle Mates GC
   *   and Gentle Mates. These are separate rosters of one organisation, and one
   *   logo is the correct answer for both.
   *
   *   TEAM VISION resolves to PARIVISION because it is that organisation's
   *   former name. The logo is still right; what is wrong is that our database
   *   holds the same team twice.
   *
   * Neither is fixed by withholding a logo, and in the first case withholding
   * one would be a regression. So this prints what it saw and leaves the rows
   * alone — a duplicate team is a separate job with rating consequences.
   */
  const perTitle = new Map<string, string[]>();
  for (const f of found) {
    const key = `${f.wiki}/${f.title}`;
    if (!perTitle.has(key)) perTitle.set(key, []);
    perTitle.get(key)!.push(f.slug);
  }
  for (const [key, slugs] of perTitle) {
    if (slugs.length < 2) continue;
    console.log(`\n?  «${key}» -> ${slugs.join(", ")}`);
    console.log(`   Ya eyni təşkilatın iki heyəti, ya da bazada təkrar komanda. Yoxlanmalıdır.`);
  }

  // 2. Fayl adlarından real URL.
  //
  // Sorğu wiki-yə görə qruplaşdırılır: hər wiki-nin öz api.php-si var və
  // faylı yalnız ona istinad edən wiki tanıyır. Fayllar isə ortaq commons-da
  // saxlanılır, ona görə nəticə açarı kimi başlıq kifayətdir.
  const perWiki = new Map<string, Set<string>>();
  for (const f of found) {
    if (!perWiki.has(f.wiki)) perWiki.set(f.wiki, new Set());
    for (const c of variantsOf(f.file)) perWiki.get(f.wiki)!.add(`File:${c}`);
    for (const c of variantsOf(f.fileLight, ["allmode", "lightmode"])) {
      perWiki.get(f.wiki)!.add(`File:${c}`);
    }
  }

  const byTitle = new Map<string, { url: string; size: number; width: number; height: number }>();
  for (const [wiki, titles] of perWiki) {
    const list = [...titles];
    // 50 başlıq bir sorğunun həddidir.
    for (let i = 0; i < list.length; i += 50) {
      const info = await api(wiki, {
        action: "query",
        prop: "imageinfo",
        iiprop: "url|size|mime|dimensions",
        titles: list.slice(i, i + 50).join("|"),
      });
      for (const p of info?.query?.pages ?? []) {
        const ii = p?.imageinfo?.[0];
        if (ii?.url) byTitle.set(p.title, { url: ii.url, size: ii.size, width: ii.width, height: ii.height });
      }
    }
  }

  /**
   * Kvadrata ən yaxın variant seçilir, adına görə deyil ölçüsünə görə.
   * Avatar 32px kvadratdır: 4259x1659 geniş yazı-loqo orada oxunmur, çünki
   * hündürlüyə sığdırılanda hərflər bir neçə piksel qalır.
   */
  const urlByTitle = new Map<string, { url: string; size: number }>();
  const resolve = (file: string, alternates?: string[]) => {
    const options = variantsOf(file, alternates)
      .map((c) => ({ title: `File:${c}`, hit: byTitle.get(`File:${c}`) }))
      .filter((o): o is { title: string; hit: NonNullable<ReturnType<typeof byTitle.get>> } => Boolean(o.hit));
    if (options.length === 0) return;
    const best = options.sort(
      (a, b) =>
        Math.abs(Math.log(a.hit.width / a.hit.height)) - Math.abs(Math.log(b.hit.width / b.hit.height)),
    )[0];
    urlByTitle.set(`File:${file}`, { url: best.hit.url, size: best.hit.size });
    return best.title;
  };

  for (const f of found) {
    const bestDark = resolve(f.file);
    if (bestDark && bestDark !== `File:${f.file}`) {
      console.log(`   ${f.slug}: kvadrat variant seçildi — ${bestDark.replace("File:", "")}`);
    }
    if (f.fileLight !== f.file) resolve(f.fileLight, ["allmode", "lightmode"]);
  }

  console.log("");
  if (!apply) {
    for (const f of found) {
      const hit = urlByTitle.get(`File:${f.file}`);
      console.log(`${f.slug.padEnd(24)} ${hit ? `${(hit.size / 1024).toFixed(0)} KB  ${hit.url}` : "URL TAPILMADI"}`);
    }
    console.log(`\n${found.length} loqo hazırdır. Yazmaq üçün --apply əlavə et.`);
    return;
  }

  // 3. Yüklə, kiçilt, yaz.
  let sharp: (typeof import("sharp"))["default"];
  try {
    sharp = (await import("sharp")).default;
  } catch {
    throw new Error("sharp tapılmadı. `npm i -D sharp` işlət və yenidən cəhd et.");
  }

  await mkdir(OUT_DIR, { recursive: true });
  // Mövcud manifest üzərinə yazılır, əvəz edilmir: `--game dota2` ilə qaçış
  // CS2 sətirlərini silməməlidir.
  const manifest: Record<string, string> = existsSync(MANIFEST)
    ? JSON.parse(readFileSync(MANIFEST, "utf8"))
    : {};
  let written = 0;
  let bytes = 0;

  /**
   * Kvadrata DOLDURULMUR. Əvvəl hər loqo 256x256 şəffaf kətana yerləşdirilirdi;
   * geniş söznişan (Vitality 3.46, LOUD 5.4 nisbətində) beləliklə kətanın üçdə
   * birini tuturdu və 28 piksellik xanada 8 piksellik zolağa çevrilirdi. İndi öz
   * nisbəti saxlanılır və uzun kənar SIZE olur; xananın enini
   * components/common/TeamAvatar.tsx verir.
   */
  const shrink = (raw: Buffer) =>
    sharp(raw).trim({ threshold: 1 }).resize(SIZE, SIZE, { fit: "inside" }).png({ compressionLevel: 9 }).toBuffer();

  /** Bir faylı endirib normallaşdırır. */
  const grab = async (title: string) => {
    const hit = urlByTitle.get(`File:${title}`);
    if (!hit) return null;
    const res = await fetch(hit.url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) return null;
    const raw = Buffer.from(await res.arrayBuffer());
    return { rawSize: raw.length, png: await shrink(raw) };
  };

  for (const f of found) {
    const dark = await grab(f.file);
    if (!dark) {
      console.log(`!  ${f.slug.padEnd(24)} yüklənmədi`);
      continue;
    }

    await writeFile(path.join(OUT_DIR, `${f.slug}.png`), dark.png);
    manifest[f.slug] = `/teams/${f.slug}.png`;
    bytes += dark.png.length;

    // İşıqlı variant HƏMİŞƏ yazılır — ayrı fayl olmasa belə eyni şəkil. Səbəb
    // sadəlikdir: komponent `<slug>-light.png`-in mövcudluğunu yoxlamır, sadəcə
    // ünvanı çıxarır. Fərqli fayl gəlməyəndə iki nüsxə eyni olur və bu, düzgün
    // nəticədir — `allmode` loqo hər fonda işləyir.
    const light = f.fileLight === f.file ? dark : ((await grab(f.fileLight)) ?? dark);
    await writeFile(path.join(OUT_DIR, `${f.slug}-light.png`), light.png);
    bytes += light.png.length;

    written++;
    const note = light === dark ? "" : `  + işıqlı ${(light.png.length / 1024).toFixed(0)} KB`;
    console.log(`+  ${f.slug.padEnd(24)} ${(dark.rawSize / 1024).toFixed(0)} KB -> ${(dark.png.length / 1024).toFixed(0)} KB${note}`);
  }

  const ordered = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(MANIFEST, JSON.stringify(ordered, null, 2) + "\n");
  console.log(`\nbu qaçışda: ${written} loqo, ${(bytes / 1024).toFixed(0)} KB`);
  console.log(`manifestdə cəmi: ${Object.keys(ordered).length}`);
  console.log(`Manifest: data/team-logos.json`);
  console.log(`Bazaya yazmaq üçün: scripts/apply-team-logos.ts (GitHub Actions-da)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
