/**
 * Downloads the CONFIRMED player photos and crops them to square avatars.
 *
 *   npx tsx scripts/fetch-player-photos.ts            # quru işlətmə
 *   npx tsx scripts/fetch-player-photos.ts --apply    # public/players/*.jpg yazır
 *
 * Reads `data/player-photos.json` — the hand-checked list. It does NOT read the
 * candidates file: a candidate is a guess until someone has looked at the
 * picture, and this script is the point where the guess would become a claim on
 * a real person's page. An entry without a `checked` date is skipped.
 *
 * Licensing. Every file here is CC BY, CC BY-SA, CC0 or public domain, taken
 * from Wikimedia Commons, and the licence plus the photographer are carried in
 * the same JSON so the site can print them. That is not decoration: CC BY and
 * CC BY-SA REQUIRE attribution, and the /credits page exists to give it.
 *
 * Cropping is a derivative work. For CC BY-SA that means the crop carries the
 * same licence, which the credits page states. It also means the crop must be
 * marked as a change, which the same line does.
 */
import "dotenv/config";
import { writeFile, mkdir } from "node:fs/promises";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const USER_AGENT = "ArenaHub/0.1 (esports site; contact: emil.tahirov24@gmail.com)";
const CONFIRMED = path.join(process.cwd(), "data", "player-photos.json");
const OUT_DIR = path.join(process.cwd(), "public", "players");
/** 72px on the player page, 40px elsewhere; 256 covers both on a retina screen. */
const SIZE = 256;
const GAP_MS = 300;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type PlayerPhoto = {
  file: string;
  license: string;
  author: string;
  source: string;
  /** ISO date the picture was looked at. Missing means not verified — skipped. */
  checked?: string;
};

async function main() {
  const apply = process.argv.includes("--apply");
  console.log(apply ? "REJIM: yazma (--apply)\n" : "REJIM: quru işlətmə\n");

  if (!existsSync(CONFIRMED)) {
    console.log("data/player-photos.json yoxdur — əvvəlcə namizədləri təsdiqlə.");
    return;
  }
  const confirmed: Record<string, PlayerPhoto> = JSON.parse(readFileSync(CONFIRMED, "utf8"));

  const ready = Object.entries(confirmed).filter(([slug, p]) => {
    if (!p.checked) {
      console.log(`—  ${slug}: `.padEnd(26) + "`checked` yoxdur, atlanır");
      return false;
    }
    return true;
  });
  console.log(`${ready.length} təsdiqlənmiş şəkil\n`);
  if (!apply) {
    for (const [slug, p] of ready) console.log(`   ${slug.padEnd(22)} ${p.license.padEnd(14)} ${p.author}`);
    console.log("\nYazmaq üçün: --apply");
    return;
  }

  const sharp = (await import("sharp")).default;
  await mkdir(OUT_DIR, { recursive: true });

  let written = 0;
  let bytes = 0;
  for (const [slug, photo] of ready) {
    // Kiçildilmiş variant istənilir, orijinal yox: Commons-dakı fayllar çox vaxt
    // bir neçə meqabaytdır və bizə 256 piksel lazımdır.
    await sleep(GAP_MS);
    const api = `https://commons.wikimedia.org/w/api.php?${new URLSearchParams({
      format: "json",
      formatversion: "2",
      action: "query",
      titles: photo.file,
      prop: "imageinfo",
      iiprop: "url",
      iiurlwidth: "600",
    })}`;
    const meta = await (await fetch(api, { headers: { "User-Agent": USER_AGENT } })).json();
    const ii = meta?.query?.pages?.[0]?.imageinfo?.[0];
    const url: string | undefined = ii?.thumburl ?? ii?.url;
    if (!url) {
      console.log(`!  ${slug.padEnd(22)} şəkil ünvanı tapılmadı`);
      continue;
    }

    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) {
      console.log(`!  ${slug.padEnd(22)} yüklənmədi (${res.status})`);
      continue;
    }
    const raw = Buffer.from(await res.arrayBuffer());

    // Yuxarıdan kəsilir. Əvvəl `sharp.strategy.attention` işlədilmişdi — o,
    // şəklin ən «diqqət çəkən» hissəsini axtarır, səhnə fotolarında isə bu, üz
    // yox, arxadakı işıqlar və loqolar olur. Nəticə gözlə görüldü: mezii-nin
    // avatarı sinəsini, Hans Sama-nınkı isə arxadakı komanda nişanını verirdi və
    // ikisi də yanlış adam təəssüratı yaradırdı.
    //
    // Portret şəkillərdə baş yuxarıdadır, ona görə sadə qayda daha yaxşı işləyir.
    const jpg = await sharp(raw)
      .resize(SIZE, SIZE, { fit: "cover", position: "top" })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();

    await writeFile(path.join(OUT_DIR, `${slug}.jpg`), jpg);
    written++;
    bytes += jpg.length;
    console.log(`+  ${slug.padEnd(22)} ${(raw.length / 1024).toFixed(0)} KB -> ${(jpg.length / 1024).toFixed(0)} KB`);
  }

  console.log(`\n${written} şəkil, ${(bytes / 1024).toFixed(0)} KB`);
  console.log("Bazaya yazmaq üçün: scripts/apply-player-photos.ts");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
