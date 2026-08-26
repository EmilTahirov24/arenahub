/**
 * Bir suala cavab verir: adam qeydiyyatdan keçib öz hesabını idarə edə bilirmi?
 *
 * Qeydiyyat yoxlamaları, e-poçt təsdiqi linkinin iki dəfə işləməsi, profil
 * redaktəsi, komanda yaradılışı və matç proqnozu. Proqnoz hissəsi həm də
 * `revalidatePath` düzəlişini yoxlayır: seçim ✓-i əl ilə yeniləmədən yerini
 * dəyişməlidir.
 *
 *   npm run dev
 *   npx tsx e2e/03-player.ts
 *
 * E-poçt üçün qəsdən `.invalid` domeni işlədilir — bu domen heç vaxt həll
 * olunmur, ona görə heç bir real məktub göndərilmir.
 *
 * DİQQƏT: qeydiyyat saatda 5 cəhdlə məhdudlaşır (lib/rateLimit.ts) və hər qaçış
 * bundan 2-sini yeyir, yəni dəst saatda ~2 dəfə qaçır. Sayğac server prosesinin
 * yaddaşındadır — `npm run dev`-i yenidən başlatmaq onu sıfırlayır. Limitə
 * dəyəndə yoxlama bunu adı ilə deyir, sükutla sınmır.
 */
import {
  BASE,
  launch,
  newPage,
  check,
  assert,
  report,
  reportProblems,
  submitForm,
  assertNotErrorPage,
  visibleText,
  gotoPage,
} from "./_lib";
import { prisma } from "../lib/prisma";
import { createVerifyToken } from "../lib/emailVerification";

const EMAIL = "e2e-oyuncu@arenahub.invalid";
const NICK = "E2ESinaqci";
const PASSWORD = "sinaq12345";
const TEAM = "E2E Sınaq Komandası";

async function cleanup() {
  const players = await prisma.player.findMany({
    where: { OR: [{ email: EMAIL }, { nickname: NICK }] },
    select: { id: true },
  });
  const ids = players.map((p) => p.id);
  const teams = await prisma.team.findMany({ where: { name: { startsWith: "E2E" } }, select: { id: true } });
  const teamIds = teams.map((t) => t.id);

  if (ids.length) {
    await prisma.matchPrediction.deleteMany({ where: { playerId: { in: ids } } });
    await prisma.playerMatchStat.deleteMany({ where: { playerId: { in: ids } } });
    await prisma.teamInvite.deleteMany({ where: { playerId: { in: ids } } });
    await prisma.profileClaim.deleteMany({ where: { claimantId: { in: ids } } });
  }
  if (teamIds.length) {
    await prisma.teamMembership.deleteMany({ where: { teamId: { in: teamIds } } });
    await prisma.teamInvite.deleteMany({ where: { teamId: { in: teamIds } } });
    await prisma.team.deleteMany({ where: { id: { in: teamIds } } });
  }
  if (ids.length) {
    await prisma.teamMembership.deleteMany({ where: { playerId: { in: ids } } });
    await prisma.player.deleteMany({ where: { id: { in: ids } } });
  }
  console.log(`(təmizləndi: ${ids.length} hesab, ${teamIds.length} komanda)\n`);
}

async function main() {
  await cleanup();

  const browser = await launch();
  const { page, problems } = await newPage(browser);

  console.log("Qeydiyyat\n");

  await check("6 simvoldan qısa şifrə rədd olunur", async () => {
    await gotoPage(page, `${BASE}/player/register`);
    await page.fill('input[name="nickname"]', NICK);
    await page.selectOption('select[name="gameId"]', { index: 1 });
    await page.fill('input[name="email"]', EMAIL);
    await page.fill('input[name="password"]', "12345");
    await page.check('input[name="terms"]');
    // minLength brauzer səviyyəsində saxlayır — formanın göndərilmədiyini yoxlayırıq.
    await page.click('form button[type="submit"]');
    await page.waitForTimeout(1000);
    assert(page.url().includes("/player/register"), "qısa şifrə ilə qeydiyyat keçdi");
  });

  await check("şərtlər qutusu işarəsiz qeydiyyat keçmir", async () => {
    await gotoPage(page, `${BASE}/player/register`);
    await page.fill('input[name="nickname"]', NICK);
    await page.selectOption('select[name="gameId"]', { index: 1 });
    await page.fill('input[name="email"]', EMAIL);
    await page.fill('input[name="password"]', PASSWORD);
    await page.click('form button[type="submit"]');
    await page.waitForTimeout(1000);
    assert(page.url().includes("/player/register"), "şərtlər qəbul edilmədən qeydiyyat keçdi");
  });

  await check("düzgün məlumatla qeydiyyat panelə aparır", async () => {
    await gotoPage(page, `${BASE}/player/register`);
    await page.fill('input[name="nickname"]', NICK);
    await page.selectOption('select[name="gameId"]', { label: "Counter-Strike 2" });
    await page.fill('input[name="email"]', EMAIL);
    await page.fill('input[name="password"]', PASSWORD);
    await page.check('input[name="terms"]');
    await submitForm(page, "form");
    // Saatda 5 qeydiyyat limiti var (lib/rateLimit.ts) və sayğac yaddaşdadır.
    // Dəst arda-arda qaçırılanda limit dolur — bu, tətbiqin səhvi deyil, ona görə
    // səbəbi açıq yazırıq: dev serveri yenidən başlatmaq sayğacı sıfırlayır.
    const afterSubmit = await visibleText(page);
    assert(
      !/Çox sayda qeydiyyat/i.test(afterSubmit),
      "qeydiyyat limiti dolub (saatda 5). Dev serveri yenidən başladın — sayğac yaddaşdadır.",
    );
    await page.waitForURL((u) => u.pathname.startsWith("/player"), { timeout: 30_000 });
    assert(!page.url().includes("/register"), `panelə düşmədi: ${page.url()}`);
    const created = await prisma.player.findUnique({ where: { email: EMAIL } });
    assert(created, "hesab bazada yaradılmadı");
    assert(created.isClaimed, "hesab isClaimed olmalıdır");
  });

  await check("eyni e-poçtla ikinci qeydiyyat rədd olunur", async () => {
    const ctx = await browser.newContext();
    const p2 = await ctx.newPage();
    await p2.goto(`${BASE}/player/register`, { waitUntil: "domcontentloaded" });
    await p2.fill('input[name="nickname"]', `${NICK}2`);
    await p2.selectOption('select[name="gameId"]', { label: "Counter-Strike 2" });
    await p2.fill('input[name="email"]', EMAIL);
    await p2.fill('input[name="password"]', PASSWORD);
    await p2.check('input[name="terms"]');
    await p2.click('form button[type="submit"]');
    await p2.waitForLoadState("networkidle", { timeout: 30_000 });
    const body = await p2.locator("body").innerText();
    await ctx.close();
    assert(
      !/Çox sayda qeydiyyat/i.test(body),
      "qeydiyyat limiti dolub (saatda 5). Dev serveri yenidən başladın — sayğac yaddaşdadır.",
    );
    assert(/artıq qeydiyyatdan keçib/i.test(body), "təkrar e-poçt üçün xəbərdarlıq yoxdur");
  });

  console.log("\nE-poçt təsdiqi\n");

  await check("təsdiq linki iki dəfə açılanda hər ikisində uğurlu olur", async () => {
    // Bazada tokenin HASH-i saxlanılır, xam dəyər isə yalnız məktuba düşür
    // (lib/tokens.ts). Məktubu tuta bilmədiyimiz üçün eyni funksiya ilə təzə cüt
    // yaradıb hash-i bazaya yazırıq və xam yarısı ilə linki açırıq.
    const player = await prisma.player.findUniqueOrThrow({ where: { email: EMAIL } });
    assert(player.verifyToken, "qeydiyyat verifyToken yaratmayıb");

    const fresh = createVerifyToken();
    await prisma.player.update({
      where: { id: player.id },
      data: { verifyToken: fresh.hash, verifyTokenExpiry: fresh.expiresAt, emailVerified: false },
    });

    for (const attempt of ["birinci", "ikinci"]) {
      await gotoPage(page, `${BASE}/player/verify-email?token=${fresh.raw}`);
      assert(
        page.url().includes("verify=success"),
        `${attempt} açılışda uğursuz: ${page.url()}`,
      );
    }
    const after = await prisma.player.findUniqueOrThrow({ where: { email: EMAIL } });
    assert(after.emailVerified, "emailVerified qeyd olunmadı");
  });

  await check("yanlış token invalid mesajı verir", async () => {
    await gotoPage(page, `${BASE}/player/verify-email?token=belke-de-yoxdur`);
    assert(page.url().includes("verify=invalid"), `gözlənilməz nəticə: ${page.url()}`);
  });

  console.log("\nProfil və komanda\n");

  await check("panelə giriş", async () => {
    await gotoPage(page, `${BASE}/player/login`);
    await page.fill('input[name="email"]', EMAIL);
    await page.fill('input[name="password"]', PASSWORD);
    await submitForm(page, "form");
    await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 30_000 });
    await assertNotErrorPage(page);
  });

  await check("profil saxlanır və «Yadda saxlanıldı ✓» göstərir", async () => {
    await gotoPage(page, `${BASE}/player/edit`);
    await page.fill('input[name="firstName"]', "Sınaq");
    await page.fill('input[name="role"]', "AWPer");
    await submitForm(page, 'form:has(input[name="social_twitch"])');
    const body = await visibleText(page);
    assert(/saxlanıldı/i.test(body), "yadda saxlanma təsdiqi yoxdur");
    const saved = await prisma.player.findUniqueOrThrow({ where: { email: EMAIL } });
    assert(saved.firstName === "Sınaq", "ad bazaya yazılmadı");
    assert(saved.role === "AWPer", "rol bazaya yazılmadı");
  });

  // Sosial sahələr `type="url"` + `pattern` ilə qorunur, yəni pozuq link brauzerin
  // özündə saxlanılır və serverə heç çatmır. Serverdəki rədd etmə arxa cəbhədir.
  await check("pozuq sosial link sahənin öz yoxlaması ilə saxlanılır", async () => {
    await gotoPage(page, `${BASE}/player/edit`);
    const twitch = page.locator('input[name="social_twitch"]');
    assert(await twitch.count(), "twitch sahəsi tapılmadı");
    await twitch.fill("not-a-url");
    const valid = await twitch.evaluate((el) => (el as HTMLInputElement).checkValidity());
    assert(!valid, "pozuq link etibarlı sayılır — sahədə pattern işləmir");

    await twitch.fill("https://twitch.tv/e2esinaqci");
    const validNow = await twitch.evaluate((el) => (el as HTMLInputElement).checkValidity());
    assert(validNow, "düzgün twitch linki rədd edilir");
    await submitForm(page, 'form:has(input[name="social_twitch"])');
    const saved = await prisma.player.findUniqueOrThrow({ where: { email: EMAIL } });
    assert(JSON.stringify(saved.socials ?? {}).includes("twitch.tv/e2esinaqci"), "düzgün link yadda saxlanmadı");
  });

  await check("komanda yaradılır və panel onu göstərir", async () => {
    await gotoPage(page, `${BASE}/player/team`);
    await page.fill('input[name="name"]', TEAM);
    await page.selectOption('select[name="gameId"]', { label: "Counter-Strike 2" });
    await submitForm(page, 'form:has(input[name="name"])');
    const body = await visibleText(page);
    assert(body.includes(TEAM), "yaradılan komanda panelə düşmədi");
    const team = await prisma.team.findFirst({ where: { name: TEAM }, include: { owner: true } });
    assert(team?.owner?.email === EMAIL, "komandanın sahibi düzgün təyin olunmadı");
  });

  console.log("\nProqnoz\n");

  await check("proqnoz seçimi ✓ ilə dərhal görünür", async () => {
    const match = await prisma.match.findFirst({
      where: { status: "UPCOMING" },
      include: { teamA: true, teamB: true },
      orderBy: { scheduledAt: "asc" },
    });
    assert(match, "UPCOMING matç yoxdur — bu yoxlama üçün lazımdır");

    await gotoPage(page, `${BASE}/az/matches/${match.slug}`);
    await assertNotErrorPage(page);

    const button = page.locator(`form button:has-text("${match.teamA.name}")`).first();
    assert(await button.count(), "proqnoz düyməsi tapılmadı");
    await button.click();
    await page.waitForLoadState("networkidle", { timeout: 30_000 });

    // Səhifəni ƏL İLƏ yeniləmirik: düzgün revalidate olsa ✓ elə burada görünür.
    const marked = await page
      .locator(`form:has(button:has-text("${match.teamA.name}")) button:has-text("✓")`)
      .count();
    assert(marked > 0, "seçim yadda saxlanıldı, amma ✓ yenilənmədən görünmür");

    const saved = await prisma.matchPrediction.findFirst({
      where: { matchId: match.id },
      include: { player: true },
    });
    assert(saved?.player.email === EMAIL, "proqnoz bazaya yazılmadı");
    assert(saved.predictedWinnerId === match.teamAId, "yanlış komanda yazılıb");
  });

  await check("matç səhifəsindən lider cədvəlinə keçid var", async () => {
    const match = await prisma.match.findFirst({ where: { status: "UPCOMING" }, orderBy: { scheduledAt: "asc" } });
    await gotoPage(page, `${BASE}/az/matches/${match!.slug}`);
    const link = page.locator('a[href="/az/predictions"]').first();
    assert(await link.count(), "lider cədvəli linki yoxdur");
    await link.click();
    await page.waitForURL((u) => u.pathname.endsWith("/predictions"), { timeout: 30_000 });
    await assertNotErrorPage(page);
  });

  reportProblems(problems);
  report("Oyunçu paneli");
  await browser.close();
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
