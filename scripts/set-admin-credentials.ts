/**
 * SUPER_ADMIN hesabının e-poçt və şifrəsini dəyişir.
 *
 *   npx tsx scripts/set-admin-credentials.ts --email <ünvan> --password <şifrə>
 *
 * Hansı bazaya yazdığı `DATABASE_URL`-dən asılıdır: .env yerli bazanı göstərir,
 * ona görə bu, standart halda YERLİ hesabı dəyişir. Canlı baza üçün açar bu
 * maşından oxunmur (Vercel-də `Secret`-dir) — orada panelin öz forması
 * işlədilir: /admin/users.
 *
 * `lib/*` `server-only` olduğu üçün klient burada ayrıca qurulur.
 */
import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = arg("email")?.trim().toLowerCase();
  const password = arg("password");
  if (!email || !password) {
    console.error("İşlədilməsi: --email <ünvan> --password <şifrə>");
    process.exit(1);
  }
  if (!email.includes("@")) {
    console.error("E-poçt düzgün görünmür.");
    process.exit(1);
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL yoxdur.");
    process.exit(1);
  }
  console.log(`Baza: ${new URL(url).hostname}`);

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    const admins = await prisma.adminUser.findMany({
      where: { role: "SUPER_ADMIN" },
      select: { id: true, email: true },
      orderBy: { createdAt: "asc" },
    });
    if (admins.length === 0) {
      console.error("SUPER_ADMIN tapılmadı.");
      process.exit(1);
    }
    if (admins.length > 1) {
      console.log(`Diqqət: ${admins.length} SUPER_ADMIN var, birincisi dəyişdirilir.`);
    }
    const target = admins[0];

    // Başqa hesab bu e-poçtu tutubsa, `@unique` pozulur və Prisma anlaşılmaz
    // xəta verir. Əvvəlcədən deyilsə daha aydındır.
    const clash = await prisma.adminUser.findFirst({ where: { email, NOT: { id: target.id } } });
    if (clash) {
      console.error(`Bu e-poçt başqa admin hesabındadır: ${email}`);
      process.exit(1);
    }

    await prisma.adminUser.update({
      where: { id: target.id },
      data: { email, passwordHash: await bcrypt.hash(password, 10) },
    });
    console.log(`Dəyişdi: ${target.email}  ->  ${email}`);
    console.log("Şifrə yeniləndi.");

    if (password.length < 12) {
      console.log(`\nXƏBƏRDARLIQ: şifrə ${password.length} simvoldur. Panel ictimai ünvandadır.`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(String(e).split("\n")[0]);
  process.exit(1);
});
