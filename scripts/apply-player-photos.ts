/**
 * Points players at the photo files that scripts/fetch-player-photos.ts wrote.
 *
 *   npx tsx scripts/apply-player-photos.ts            # dry run
 *   npx tsx scripts/apply-player-photos.ts --apply
 *
 * The database half of the split, mirroring scripts/apply-team-logos.ts: that
 * one has the network, this one has the rows and makes no network calls.
 *
 * Only entries with a `checked` date are written. That field is what separates
 * a candidate someone looked at from a search result nobody did, and this is
 * the last place it can be enforced before a picture appears next to a real
 * person's name.
 *
 * A photo a player uploaded themselves is never overwritten: an entry whose
 * `photoUrl` does not point at /players/ is left alone.
 */
import "dotenv/config";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import type { PlayerPhoto } from "./fetch-player-photos";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const CONFIRMED = path.join(process.cwd(), "data", "player-photos.json");
const FILES = path.join(process.cwd(), "public", "players");

async function main() {
  const apply = process.argv.includes("--apply");
  const confirmed: Record<string, PlayerPhoto> = JSON.parse(readFileSync(CONFIRMED, "utf8"));

  const ready = Object.entries(confirmed).filter(([slug, p]) => {
    if (!p.checked) return false;
    // Fayl yoxdursa yazmırıq: baza sınıq ünvana işarə etməməlidir.
    return existsSync(path.join(FILES, `${slug}.jpg`));
  });

  console.log(`təsdiqlənmiş və faylı olan: ${ready.length}${apply ? "" : "  (QURU İŞLƏTMƏ)"}\n`);

  const players = await prisma.player.findMany({
    where: { slug: { in: ready.map(([s]) => s) } },
    select: { id: true, slug: true, nickname: true, photoUrl: true },
  });
  const bySlug = new Map(players.map((p) => [p.slug, p]));

  let changed = 0;
  let same = 0;
  let ownPhoto = 0;
  const missing: string[] = [];

  for (const [slug] of ready) {
    const player = bySlug.get(slug);
    if (!player) {
      missing.push(slug);
      continue;
    }
    const url = `/players/${slug}.jpg`;
    if (player.photoUrl === url) {
      same++;
      continue;
    }
    if (player.photoUrl && !player.photoUrl.startsWith("/players/")) {
      // Oyunçu öz şəklini yükləyib — o, bizim seçdiyimizdən üstündür.
      ownPhoto++;
      continue;
    }
    console.log(`+  ${player.nickname.padEnd(20)} ${player.photoUrl ?? "(boş)"} -> ${url}`);
    if (apply) {
      await prisma.player.update({ where: { id: player.id }, data: { photoUrl: url } });
    }
    changed++;
  }

  console.log(`\n${changed} dəyişdi, ${same} onsuz da düzgün, ${ownPhoto} öz şəkli saxlanıldı`);
  if (missing.length) {
    console.log(`\nBazada tapılmayan ${missing.length} slug: ${missing.slice(0, 10).join(", ")}`);
  }
  if (!apply) console.log("\nTətbiq etmək üçün: --apply");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
