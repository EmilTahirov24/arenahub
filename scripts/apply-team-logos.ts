/**
 * Points teams at the logo files that scripts/fetch-team-logos.ts committed.
 *
 *   npx tsx scripts/apply-team-logos.ts            # dry run
 *   npx tsx scripts/apply-team-logos.ts --apply
 *
 * The other half of the split described in fetch-team-logos.ts: that script has
 * the network and writes files, this one has the database and writes rows. It
 * makes no network calls at all, so it is safe to run from CI on every change
 * to the manifest.
 *
 * A slug in the manifest with no matching team is reported rather than ignored.
 * It means the team was renamed or removed since the logo was fetched, and a
 * silently skipped row would leave a file in the repository that nothing uses.
 *
 * Builds its own PrismaClient, like the other scripts: lib/* is "server-only"
 * and throws outside Next.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const MANIFEST = path.join(process.cwd(), "data", "team-logos.json");

async function main() {
  const apply = process.argv.includes("--apply");
  const manifest: Record<string, string> = JSON.parse(readFileSync(MANIFEST, "utf8"));
  const slugs = Object.keys(manifest);

  console.log(`manifestdə: ${slugs.length} loqo${apply ? "" : "  (QURU İŞLƏTMƏ)"}\n`);

  const teams = await prisma.team.findMany({
    where: { slug: { in: slugs } },
    select: { id: true, slug: true, name: true, logoUrl: true },
  });
  const bySlug = new Map(teams.map((t) => [t.slug, t]));

  let changed = 0;
  let same = 0;
  const missing: string[] = [];

  for (const slug of slugs) {
    const team = bySlug.get(slug);
    if (!team) {
      missing.push(slug);
      continue;
    }
    if (team.logoUrl === manifest[slug]) {
      same++;
      continue;
    }
    changed++;
    console.log(`+  ${team.name.padEnd(22)} ${team.logoUrl ?? "(boş)"} -> ${manifest[slug]}`);
    if (apply) {
      await prisma.team.update({ where: { id: team.id }, data: { logoUrl: manifest[slug] } });
    }
  }

  console.log("");
  console.log(`dəyişdi:        ${changed}`);
  console.log(`onsuz da eyni:  ${same}`);
  if (missing.length > 0) {
    console.log(`komanda tapılmadı: ${missing.length} -> ${missing.join(", ")}`);
  }
  if (!apply && changed > 0) console.log("\nHeç nə yazılmadı. Yazmaq üçün --apply əlavə et.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
