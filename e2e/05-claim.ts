/**
 * Bir suala cavab verir: profil sahiblənməsi (claim) və onun birləşdirilməsi
 * düzgün işləyirmi?
 *
 * Layihənin geri qaytarıla bilməyən yeganə əməliyyatıdır. Təsdiqdə hesab sətri
 * SİLİNİR və onun hər şeyi — xal, proqnoz, statistika, tərkib və komanda
 * sahibliyi — hədəf profilə keçir; hədəf isə hesabın e-poçtunu və şifrəsini
 * götürür. Səhv getsə, geri qaytarmaq üçün heç nə yoxdur, ona görə testi olmalıdır.
 *
 *   npm run dev
 *   npx tsx e2e/05-claim.ts
 *
 * Fikstürlər Prisma ilə qurulur: qeydiyyat saatda 5 ilə məhduddur və bu dəstin
 * yoxladığı şey qeydiyyat deyil, birləşmədir.
 */
import {
  BASE,
  launch,
  newPage,
  check,
  assert,
  report,
  reportProblems,
  loginAdmin,
  submitForm,
  visibleText,
  gotoPage,
} from "./_lib";
import { prisma } from "../lib/prisma";
import bcrypt from "bcryptjs";

const SHELL_NICK = "E2EKolgeProfil";
const CLAIMANT_NICK = "E2ETelebci";
const CLAIMANT_EMAIL = "e2e-claim@arenahub.invalid";
const CLAIMANT_PASSWORD = "claim12345";
const OTHER_GAME_NICK = "E2EBasqaOyun";
const CLAIMED_NICK = "E2ESahibliProfil";

async function cleanup() {
  const players = await prisma.player.findMany({
    where: { OR: [{ nickname: { startsWith: "E2E" } }, { email: CLAIMANT_EMAIL }] },
    select: { id: true },
  });
  const ids = players.map((p) => p.id);
  if (ids.length) {
    await prisma.profileClaim.deleteMany({
      where: { OR: [{ claimantId: { in: ids } }, { playerId: { in: ids } }] },
    });
    await prisma.matchPrediction.deleteMany({ where: { playerId: { in: ids } } });
    await prisma.playerMatchStat.deleteMany({ where: { playerId: { in: ids } } });
    await prisma.teamInvite.deleteMany({ where: { playerId: { in: ids } } });
    await prisma.teamMembership.deleteMany({ where: { playerId: { in: ids } } });
    await prisma.team.updateMany({ where: { ownerId: { in: ids } }, data: { ownerId: null } });
    await prisma.player.deleteMany({ where: { id: { in: ids } } });
  }
  console.log(`(təmizləndi: ${ids.length} profil)\n`);
}

async function main() {
  await cleanup();

  const cs2 = await prisma.game.findFirstOrThrow({ where: { slug: "cs2" } });
  const otherGame = await prisma.game.findFirstOrThrow({ where: { slug: { not: "cs2" } } });
  const hash = await bcrypt.hash(CLAIMANT_PASSWORD, 10);

  // Hədəf: sahibsiz profil, öz xalı və matç statistikası var.
  const shell = await prisma.player.create({
    data: { slug: "e2e-kolge-profil", nickname: SHELL_NICK, gameId: cs2.id, isClaimed: false, points: 7 },
  });
  // Müraciətçi: qeydiyyatlı hesab, öz xalı və proqnozu var.
  const claimant = await prisma.player.create({
    data: {
      slug: "e2e-telebci",
      nickname: CLAIMANT_NICK,
      gameId: cs2.id,
      isClaimed: true,
      email: CLAIMANT_EMAIL,
      passwordHash: hash,
      emailVerified: true,
      points: 5,
    },
  });
  // Blok yoxlamaları üçün: başqa oyunda sahibsiz profil və artıq sahibi olan profil.
  await prisma.player.create({
    data: { slug: "e2e-basqa-oyun", nickname: OTHER_GAME_NICK, gameId: otherGame.id, isClaimed: false },
  });
  await prisma.player.create({
    data: { slug: "e2e-sahibli-profil", nickname: CLAIMED_NICK, gameId: cs2.id, isClaimed: true },
  });

  const match = await prisma.match.findFirstOrThrow({ where: { status: "FINISHED" } });
  await prisma.matchPrediction.create({
    data: { matchId: match.id, playerId: claimant.id, predictedWinnerId: match.teamAId },
  });

  const browser = await launch();
  const { page, problems } = await newPage(browser);

  async function loginClaimant() {
    await gotoPage(page, `${BASE}/player/login`);
    await page.fill('input[name="email"]', CLAIMANT_EMAIL);
    await page.fill('input[name="password"]', CLAIMANT_PASSWORD);
    await submitForm(page, "form");
    await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 30_000 });
  }

  await loginClaimant();
  console.log("Müraciətçi girişi: ok\n");

  console.log("Axtarışın sərhədləri\n");

  await check("başqa oyunun profili axtarışda çıxmır", async () => {
    await gotoPage(page, `${BASE}/player/claim`);
    await page.fill('input[name="query"]', OTHER_GAME_NICK);
    await submitForm(page, 'form:has(input[name="query"])');
    const body = await visibleText(page);
    assert(!body.includes(OTHER_GAME_NICK), "başqa oyunun profili nəticələrdə göründü");
    assert(/tapılmadı/i.test(body), "boş nəticə mesajı yoxdur");
  });

  await check("artıq sahibi olan profil axtarışda çıxmır", async () => {
    await gotoPage(page, `${BASE}/player/claim`);
    await page.fill('input[name="query"]', CLAIMED_NICK);
    await submitForm(page, 'form:has(input[name="query"])');
    const body = await visibleText(page);
    assert(!body.includes(CLAIMED_NICK), "sahibi olan profil nəticələrdə göründü");
  });

  console.log("\nMüraciətin göndərilməsi\n");

  await check("sahibsiz profil tapılır və müraciət göndərilir", async () => {
    await gotoPage(page, `${BASE}/player/claim`);
    await page.fill('input[name="query"]', SHELL_NICK);
    await submitForm(page, 'form:has(input[name="query"])');
    let body = await visibleText(page);
    assert(body.includes(SHELL_NICK), "sahibsiz profil axtarışda tapılmadı");

    // Mətn sahəsi yalnız «Bu mənəm» seçiləndən sonra açılır.
    await page.locator('button:has-text("Bu mənəm")').first().click();
    await page.locator('textarea[name="message"]').first().fill(
      "Bu mənim köhnə profilimdir, komandada həmin ləqəblə oynamışam.",
    );
    await submitForm(page, 'form:has(textarea[name="message"])');
    // Mesaj client tərəfdə yazılır — mətni bir anlıq oxumaq əvəzinə elementi gözləyirik.
    await page.locator("text=/Müraciət göndərildi/").first().waitFor({ timeout: 15_000 });

    const claim = await prisma.profileClaim.findFirstOrThrow({
      where: { playerId: shell.id, claimantId: claimant.id },
    });
    assert(claim.status === "PENDING", `status ${claim.status} — PENDING gözlənilirdi`);

    // Səhifə yenilənəndə müraciət «Müraciətlərim» siyahısında görünməlidir.
    await gotoPage(page, `${BASE}/player/claim`);
    body = await visibleText(page);
    assert(/Baxılır/i.test(body), "müraciət siyahısında «Baxılır» statusu yoxdur");
  });

  await check("tərkibdə olan müraciətçi bloklanır", async () => {
    const team = await prisma.team.findFirstOrThrow({ where: { gameId: cs2.id } });
    const membership = await prisma.teamMembership.create({
      data: { teamId: team.id, playerId: claimant.id, joinedAt: new Date() },
    });
    try {
      await gotoPage(page, `${BASE}/player/claim`);
      await page.fill('input[name="query"]', SHELL_NICK);
      await submitForm(page, 'form:has(input[name="query"])');
      await page.locator('button:has-text("Bu mənəm")').first().click();
      await page.locator('textarea[name="message"]').first().fill(
        "Yenidən müraciət edirəm, bu profil mənimdir.",
      );
      await submitForm(page, 'form:has(textarea[name="message"])');
      // Blok mesajı formanın altında görünməlidir, xəta ekranında yox.
      const body = await visibleText(page);
      assert(!body.includes("Əməliyyat tamamlanmadı"), "blok xəta ekranına atır, mesaj göstərilmir");
      await page
        .locator("text=/komandanızdan ayrılmalısınız/")
        .first()
        .waitFor({ timeout: 15_000 });
    } finally {
      await prisma.teamMembership.delete({ where: { id: membership.id } });
    }
  });

  console.log("\nAdmin təsdiqi və birləşmə\n");

  await check("admin müraciəti təsdiqləyir", async () => {
    await loginAdmin(page);
    await gotoPage(page, `${BASE}/admin/claims`);
    const body = await visibleText(page);
    assert(body.includes(SHELL_NICK) && body.includes(CLAIMANT_NICK), "müraciət admin siyahısında yoxdur");
    await submitForm(page, 'form:has(button:has-text("Təsdiqlə və birləşdir"))', "Təsdiqlə və birləşdir");
  });

  await check("müraciətçinin sətri silinir, hədəf profil sağ qalır", async () => {
    const gone = await prisma.player.findUnique({ where: { id: claimant.id } });
    assert(!gone, "müraciətçinin sətri hələ durur");
    const target = await prisma.player.findUnique({ where: { id: shell.id } });
    assert(target, "hədəf profil itib — birləşmə tərsinə işləyib");
  });

  await check("e-poçt, şifrə və isClaimed hədəf profilə keçir", async () => {
    const target = await prisma.player.findUniqueOrThrow({ where: { id: shell.id } });
    assert(target.email === CLAIMANT_EMAIL, `e-poçt keçmədi: ${target.email}`);
    assert(target.passwordHash === hash, "şifrə hash-i keçmədi");
    assert(target.isClaimed, "hədəf profil hələ sahibsiz sayılır");
    assert(target.emailVerified, "emailVerified keçmədi");
  });

  await check("xallar toplanır (7 + 5 = 12)", async () => {
    const target = await prisma.player.findUniqueOrThrow({ where: { id: shell.id } });
    assert(target.points === 12, `xal ${target.points} — 12 gözlənilirdi`);
  });

  await check("proqnoz hədəf profilin adına keçir", async () => {
    const moved = await prisma.matchPrediction.findFirst({ where: { matchId: match.id, playerId: shell.id } });
    assert(moved, "proqnoz köçürülməyib");
    const orphan = await prisma.matchPrediction.findFirst({ where: { playerId: claimant.id } });
    assert(!orphan, "müraciətçinin adına proqnoz qalıb");
  });

  await check("müraciət qeydi APPROVED olur və hədəfə bağlanır", async () => {
    const claim = await prisma.profileClaim.findFirstOrThrow({ where: { playerId: shell.id } });
    assert(claim.status === "APPROVED", `status ${claim.status}`);
    assert(claim.claimantId === shell.id, "müraciət qeydi silinmiş sətrə baxır");
    assert(claim.reviewedAt, "reviewedAt yazılmayıb");
  });

  console.log("\nBirləşmədən sonra giriş\n");

  await check("müraciətçi eyni şifrə ilə girib birləşmiş profilə düşür", async () => {
    await loginClaimant();
    const body = await visibleText(page);
    assert(body.includes(SHELL_NICK), `panel köhnə ləqəbi göstərir, gözlənilən: ${SHELL_NICK}`);
    assert(!body.includes(CLAIMANT_NICK), "köhnə ləqəb hələ görünür");
  });

  await check("birləşmiş profilin public səhifəsi açılır", async () => {
    const target = await prisma.player.findUniqueOrThrow({ where: { id: shell.id } });
    const res = await gotoPage(page, `${BASE}/az/players/${target.slug}`);
    assert(res && res.status() === 200, `HTTP ${res?.status()}`);
    const body = await visibleText(page);
    assert(body.includes(SHELL_NICK), "public səhifədə profil adı yoxdur");
  });

  reportProblems(problems);
  report("Profil sahiblənməsi");
  await browser.close();
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
