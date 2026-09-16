/**
 * Changes the SUPER_ADMIN account's email and password.
 *
 *   npx tsx scripts/set-admin-credentials.ts --email <address> --password <password>
 *
 * Which database it writes to depends on `DATABASE_URL`: .env points at the
 * local one, so by default this changes the LOCAL account. The key for the
 * live database is not readable from this machine (it is a `Secret` on
 * Vercel) - the panel's own form is used there instead: /admin/users.
 *
 * Since `lib/*` is `server-only`, the client is built separately here.
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
    console.error("Usage: --email <address> --password <password>");
    process.exit(1);
  }
  if (!email.includes("@")) {
    console.error("That email does not look valid.");
    process.exit(1);
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set.");
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
      console.error("No SUPER_ADMIN found.");
      process.exit(1);
    }
    if (admins.length > 1) {
      console.log(`Note: there are ${admins.length} SUPER_ADMINs; the first one is being changed.`);
    }
    const target = admins[0];

    // If another account holds this email, `@unique` is violated and Prisma
    // throws something opaque. Saying so up front is clearer.
    const clash = await prisma.adminUser.findFirst({ where: { email, NOT: { id: target.id } } });
    if (clash) {
      console.error(`That email belongs to another admin account: ${email}`);
      process.exit(1);
    }

    await prisma.adminUser.update({
      where: { id: target.id },
      data: { email, passwordHash: await bcrypt.hash(password, 10) },
    });
    console.log(`Changed: ${target.email}  ->  ${email}`);
    console.log("The password was updated.");

    if (password.length < 12) {
      console.log(`\nWARNING: the password is ${password.length} characters. The panel is at a public address.`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(String(e).split("\n")[0]);
  process.exit(1);
});
