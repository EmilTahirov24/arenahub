/**
 * Answers one question: can a person register and then run their own account?
 *
 * Registration validation, the verification link working twice, editing the
 * profile, creating a team, and predicting a match. The prediction part also
 * covers the `revalidatePath` fix: the tick must move without a manual reload.
 *
 *   npm run dev
 *   npx tsx e2e/03-player.ts
 *
 * The `.invalid` domain is used on purpose: it never resolves, so no real mail
 * is ever sent.
 *
 * NOTE: registration is limited to 5 attempts an hour (lib/rateLimit.ts) and
 * each run uses two of them, so this suite runs about twice an hour. The
 * counter lives in the server process's memory, so restarting `npm run dev`
 * resets it. When the limit is what failed, the check says so by name rather
 * than failing silently.
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
  clickAndSettle,
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
  console.log(`(cleaned up: ${ids.length} accounts, ${teamIds.length} teams)\n`);
}

async function main() {
  await cleanup();

  const browser = await launch();
  const { page, problems } = await newPage(browser);

  // Someone arriving from /en was shown the Azerbaijani form, and the consent
  // checkbox linked to /az/terms — they were being asked to accept a legal text
  // in a language they had not chosen. These two checks guard that path.
  await check("following registration from the English site opens the English form", async () => {
    await gotoPage(page, `${BASE}/en`);
    // The registration link lives inside the account menu and is not in the DOM
    // until it opens; the menu itself waits on the /api/me response.
    const authButton = page.locator('button[aria-haspopup="menu"]').first();
    await authButton.waitFor({ state: "visible", timeout: 15_000 });
    await authButton.click();

    const register = page.locator('a[href*="/player/register"]').first();
    await register.waitFor({ state: "visible", timeout: 10_000 });
    const href = await register.getAttribute("href");
    assert(href?.includes("lang=en"), `the link does not carry the language: ${href}`);

    await gotoPage(page, `${BASE}${href}`);
    const body = await visibleText(page);
    assert(/Create a player account/i.test(body), "the English text is not shown");
    assert(!/Oyunçu kimi qeydiyyatdan/.test(body), "Azerbaijani text is still there");
  });

  await check("on the English form the legal links go to the English pages", async () => {
    await gotoPage(page, `${BASE}/player/register?lang=en`);
    const terms = await page.locator('a[href$="/terms"]').first().getAttribute("href");
    const privacy = await page.locator('a[href$="/privacy"]').first().getAttribute("href");
    assert(terms === "/en/terms", `terms link: ${terms}`);
    assert(privacy === "/en/privacy", `privacy link: ${privacy}`);
  });

  await check("Azerbaijani stays the default", async () => {
    await gotoPage(page, `${BASE}/player/register`);
    const body = await visibleText(page);
    assert(/Oyunçu kimi qeydiyyatdan/.test(body), "the default language should be Azerbaijani");
    const terms = await page.locator('a[href$="/terms"]').first().getAttribute("href");
    assert(terms === "/az/terms", `terms link: ${terms}`);
  });


  console.log("Qeydiyyat\n");

  await check("a password shorter than 6 characters is rejected", async () => {
    await gotoPage(page, `${BASE}/player/register`);
    await page.fill('input[name="nickname"]', NICK);
    await page.selectOption('select[name="gameId"]', { index: 1 });
    await page.fill('input[name="email"]', EMAIL);
    await page.fill('input[name="password"]', "12345");
    await page.check('input[name="terms"]');
    // minLength stops it in the browser, so the check is that the form never submits.
    await page.click('form button[type="submit"]');
    await page.waitForTimeout(1000);
    assert(page.url().includes("/player/register"), "a short password got through registration");
  });

  await check("registration fails without the terms checkbox", async () => {
    await gotoPage(page, `${BASE}/player/register`);
    await page.fill('input[name="nickname"]', NICK);
    await page.selectOption('select[name="gameId"]', { index: 1 });
    await page.fill('input[name="email"]', EMAIL);
    await page.fill('input[name="password"]', PASSWORD);
    await page.click('form button[type="submit"]');
    await page.waitForTimeout(1000);
    assert(page.url().includes("/player/register"), "registration went through without accepting the terms");
  });

  await check("valid details register and land on the panel", async () => {
    await gotoPage(page, `${BASE}/player/register`);
    await page.fill('input[name="nickname"]', NICK);
    await page.selectOption('select[name="gameId"]', { label: "Counter-Strike 2" });
    await page.fill('input[name="email"]', EMAIL);
    await page.fill('input[name="password"]', PASSWORD);
    await page.check('input[name="terms"]');
    await submitForm(page, "form");
    // Registration is capped at 5 an hour (lib/rateLimit.ts) and the counter is
    // in memory. Running the suite repeatedly exhausts it — that is not a defect
    // in the application, so the reason is stated plainly: restarting the dev
    // server resets the counter.
    const afterSubmit = await visibleText(page);
    assert(
      !/Çox sayda qeydiyyat/i.test(afterSubmit),
      "registration limit reached (5 an hour). Restart the dev server — the counter is in memory.",
    );
    await page.waitForURL((u) => u.pathname.startsWith("/player"), { timeout: 30_000 });
    assert(!page.url().includes("/register"), `did not land on the panel: ${page.url()}`);
    const created = await prisma.player.findUnique({ where: { email: EMAIL } });
    assert(created, "the account was not created in the database");
    assert(created.isClaimed, "the account should be isClaimed");
  });

  await check("a second registration with the same email is rejected", async () => {
    const ctx = await browser.newContext();
    const p2 = await ctx.newPage();
    await p2.goto(`${BASE}/player/register`, { waitUntil: "domcontentloaded" });
    await p2.fill('input[name="nickname"]', `${NICK}2`);
    await p2.selectOption('select[name="gameId"]', { label: "Counter-Strike 2" });
    await p2.fill('input[name="email"]', EMAIL);
    await p2.fill('input[name="password"]', PASSWORD);
    await p2.check('input[name="terms"]');
    // A server action causes no navigation, so `load` never fires — wait for the
    // action's own POST response.
    await Promise.all([
      p2.waitForResponse((r) => r.request().method() === "POST", { timeout: 30_000 }).catch(() => null),
      p2.click('form button[type="submit"]'),
    ]);
    // The message renders on the client, so wait for the element rather than
    // taking one snapshot and trusting the test's own timing.
    const shown = await p2
      .locator("text=/artıq qeydiyyatdan keçib|Çox sayda qeydiyyat/")
      .first()
      .waitFor({ timeout: 15_000 })
      .then(() => true)
      .catch(() => false);
    const body = await p2.locator("body").innerText();
    await ctx.close();
    assert(
      !/Çox sayda qeydiyyat/i.test(body),
      "registration limit reached (5 an hour). Restart the server — the counter is in memory.",
    );
    assert(shown && /artıq qeydiyyatdan keçib/i.test(body), "no warning for the duplicate email");
  });

  console.log("\nEmail verification\n");

  await check("the verification link succeeds both times it is opened", async () => {
    // The database stores the token's HASH; the raw value only ever goes into
    // the email (lib/tokens.ts). Since the mail cannot be intercepted, a fresh
    // pair is made with the same function, the hash written to the database, and
    // the link opened with the raw half.
    const player = await prisma.player.findUniqueOrThrow({ where: { email: EMAIL } });
    assert(player.verifyToken, "registration did not create a verifyToken");

    const fresh = createVerifyToken();
    await prisma.player.update({
      where: { id: player.id },
      data: { verifyToken: fresh.hash, verifyTokenExpiry: fresh.expiresAt, emailVerified: false },
    });

    for (const attempt of ["first", "second"]) {
      await gotoPage(page, `${BASE}/player/verify-email?token=${fresh.raw}`);
      assert(
        page.url().includes("verify=success"),
        `failed on the ${attempt} visit: ${page.url()}`,
      );
    }
    const after = await prisma.player.findUniqueOrThrow({ where: { email: EMAIL } });
    assert(after.emailVerified, "emailVerified was not recorded");
  });

  await check("a wrong token gives the invalid message", async () => {
    await gotoPage(page, `${BASE}/player/verify-email?token=belke-de-yoxdur`);
    assert(page.url().includes("verify=invalid"), `unexpected result: ${page.url()}`);
  });

  console.log("\nProfile and team\n");

  await check("signing in to the panel", async () => {
    await gotoPage(page, `${BASE}/player/login`);
    await page.fill('input[name="email"]', EMAIL);
    await page.fill('input[name="password"]', PASSWORD);
    await submitForm(page, "form");
    await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 30_000 });
    await assertNotErrorPage(page);
  });

  // The header no longer reads the session on the server, so that pages can be
  // cached — the account arrives from /api/me on the client. These two checks
  // confirm that move cost the user nothing.
  await check("a signed-in player's nickname appears in the public header", async () => {
    await gotoPage(page, `${BASE}/az`);
    await page.locator("header").locator(`text=${NICK}`).first().waitFor({ timeout: 15_000 });
  });

  await check("the signed-out label does not flash while loading", async () => {
    await page.goto(`${BASE}/az/matches`, { waitUntil: "domcontentloaded" });
    let sawLoggedOut = false;
    for (let i = 0; i < 30; i++) {
      const header = await page.locator("header").innerText().catch(() => "");
      if (header.includes("Oyunçu yarat")) sawLoggedOut = true;
      if (header.includes(NICK)) break;
      await page.waitForTimeout(100);
    }
    assert(!sawLoggedOut, "a signed-in visitor was briefly shown the signed-out label");
    const header = await page.locator("header").innerText();
    assert(header.includes(NICK), "the nickname never appeared");
  });

  await check("the profile saves and shows a confirmation", async () => {
    await gotoPage(page, `${BASE}/player/edit`);
    await page.fill('input[name="firstName"]', "Sınaq");
    await page.fill('input[name="role"]', "AWPer");
    await submitForm(page, 'form:has(input[name="social_twitch"])');
    const body = await visibleText(page);
    assert(/saxlanıldı/i.test(body), "no save confirmation");
    const saved = await prisma.player.findUniqueOrThrow({ where: { email: EMAIL } });
    assert(saved.firstName === "Sınaq", "the name was not written to the database");
    assert(saved.role === "AWPer", "the role was not written to the database");
  });

  // The social fields are guarded by `type="url"` plus `pattern`, so a broken
  // link is stopped in the browser and never reaches the server. The server-side
  // rejection is the second line.
  await check("a broken social link is stopped by the field's own validation", async () => {
    await gotoPage(page, `${BASE}/player/edit`);
    const twitch = page.locator('input[name="social_twitch"]');
    assert(await twitch.count(), "the twitch field was not found");
    await twitch.fill("not-a-url");
    const valid = await twitch.evaluate((el) => (el as HTMLInputElement).checkValidity());
    assert(!valid, "a broken link counts as valid — the field's pattern is not working");

    await twitch.fill("https://twitch.tv/e2esinaqci");
    const validNow = await twitch.evaluate((el) => (el as HTMLInputElement).checkValidity());
    assert(validNow, "a valid twitch link is being rejected");
    await submitForm(page, 'form:has(input[name="social_twitch"])');
    const saved = await prisma.player.findUniqueOrThrow({ where: { email: EMAIL } });
    assert(JSON.stringify(saved.socials ?? {}).includes("twitch.tv/e2esinaqci"), "the valid link was not saved");
  });

  await check("a team is created and the panel shows it", async () => {
    await gotoPage(page, `${BASE}/player/team`);
    await page.fill('input[name="name"]', TEAM);
    await page.selectOption('select[name="gameId"]', { label: "Counter-Strike 2" });
    await submitForm(page, 'form:has(input[name="name"])');
    const body = await visibleText(page);
    assert(body.includes(TEAM), "the new team did not reach the panel");
    const team = await prisma.team.findFirst({ where: { name: TEAM }, include: { owner: true } });
    assert(team?.owner?.email === EMAIL, "the team owner was not set correctly");
  });

  console.log("\nProqnoz\n");

  await check("choosing a prediction shows its tick straight away", async () => {
    const match = await prisma.match.findFirst({
      where: { status: "UPCOMING" },
      include: { teamA: true, teamB: true },
      orderBy: { scheduledAt: "asc" },
    });
    assert(match, "no UPCOMING match — this check needs one");

    await gotoPage(page, `${BASE}/az/matches/${match.slug}`);
    await assertNotErrorPage(page);

    const button = page.locator(`form button:has-text("${match.teamA.name}")`).first();
    assert(await button.count(), "the prediction button was not found");
    await clickAndSettle(page, button);

    // The page is deliberately NOT reloaded: if revalidation works, the tick is
    // already here.
    const marked = await page
      .locator(`form:has(button:has-text("${match.teamA.name}")) button:has-text("✓")`)
      .count();
    assert(marked > 0, "the choice saved, but the tick needs a reload to appear");

    const saved = await prisma.matchPrediction.findFirst({
      where: { matchId: match.id },
      include: { player: true },
    });
    assert(saved?.player.email === EMAIL, "the prediction was not written to the database");
    assert(saved.predictedWinnerId === match.teamAId, "the wrong team was recorded");
  });

  await check("the match page links to the leaderboard", async () => {
    const match = await prisma.match.findFirst({ where: { status: "UPCOMING" }, orderBy: { scheduledAt: "asc" } });
    await gotoPage(page, `${BASE}/az/matches/${match!.slug}`);
    const link = page.locator('a[href="/az/predictions"]').first();
    assert(await link.count(), "no leaderboard link");
    await link.click();
    await page.waitForURL((u) => u.pathname.endsWith("/predictions"), { timeout: 30_000 });
    await assertNotErrorPage(page);
  });

  reportProblems(problems);
  report("Player account");
  await browser.close();
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
