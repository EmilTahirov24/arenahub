/**
 * Answers one question: does claiming a profile, and the merge that follows,
 * work correctly?
 *
 * This is the only irreversible operation in the project. On approval the
 * claimant's row is DELETED and everything it holds — points, predictions,
 * statistics, roster membership and team ownership — moves to the target
 * profile, which takes on the account's email and password. If it goes wrong
 * there is nothing to undo it with, which is why it has a test.
 *
 *   npm run dev
 *   npx tsx e2e/05-claim.ts
 *
 * Fixtures are built with Prisma: registration is limited to 5 an hour, and
 * what this suite checks is the merge, not registration.
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
  console.log(`(cleaned up: ${ids.length} profiles)\n`);
}

async function main() {
  await cleanup();

  const cs2 = await prisma.game.findFirstOrThrow({ where: { slug: "cs2" } });
  const otherGame = await prisma.game.findFirstOrThrow({ where: { slug: { not: "cs2" } } });
  const hash = await bcrypt.hash(CLAIMANT_PASSWORD, 10);

  // The target: an unclaimed profile with its own points and match statistics.
  const shell = await prisma.player.create({
    data: { slug: "e2e-kolge-profil", nickname: SHELL_NICK, gameId: cs2.id, isClaimed: false, points: 7 },
  });
  // The claimant: a registered account with its own points and a prediction.
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
  // For the blocking checks: an unclaimed profile in another game, and one
  // that already has an owner.
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
  console.log("Claimant signed in: ok\n");

  console.log("Limits of the search\n");

  await check("a profile from another game does not appear in the search", async () => {
    await gotoPage(page, `${BASE}/player/claim`);
    await page.fill('input[name="query"]', OTHER_GAME_NICK);
    await submitForm(page, 'form:has(input[name="query"])');
    const body = await visibleText(page);
    assert(!body.includes(OTHER_GAME_NICK), "a profile from another game showed up in the results");
    assert(/tapılmadı/i.test(body), "no empty-result message");
  });

  await check("an already claimed profile does not appear in the search", async () => {
    await gotoPage(page, `${BASE}/player/claim`);
    await page.fill('input[name="query"]', CLAIMED_NICK);
    await submitForm(page, 'form:has(input[name="query"])');
    const body = await visibleText(page);
    assert(!body.includes(CLAIMED_NICK), "a claimed profile showed up in the results");
  });

  console.log("\nSubmitting a claim\n");

  await check("an unclaimed profile is found and a claim is submitted", async () => {
    await gotoPage(page, `${BASE}/player/claim`);
    await page.fill('input[name="query"]', SHELL_NICK);
    await submitForm(page, 'form:has(input[name="query"])');
    let body = await visibleText(page);
    assert(body.includes(SHELL_NICK), "the unclaimed profile was not found by the search");

    // The message field only opens once "this is me" is chosen.
    await page.locator('button:has-text("Bu mənəm")').first().click();
    await page.locator('textarea[name="message"]').first().fill(
      "Bu mənim köhnə profilimdir, komandada həmin ləqəblə oynamışam.",
    );
    await submitForm(page, 'form:has(textarea[name="message"])');
    // The message is rendered on the client, so wait for the element rather
    // than reading the text at one instant.
    await page.locator("text=/Müraciət göndərildi/").first().waitFor({ timeout: 15_000 });

    const claim = await prisma.profileClaim.findFirstOrThrow({
      where: { playerId: shell.id, claimantId: claimant.id },
    });
    assert(claim.status === "PENDING", `status ${claim.status} — expected PENDING`);

    // On reload the claim must appear in the claimant's own list.
    await gotoPage(page, `${BASE}/player/claim`);
    body = await visibleText(page);
    assert(/Baxılır/i.test(body), "the claim list does not show the pending status");
  });

  await check("a claimant who is on a roster is blocked", async () => {
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
      // The block must be shown under the form, not on an error screen.
      const body = await visibleText(page);
      assert(!body.includes("Əməliyyat tamamlanmadı"), "the block throws to an error screen instead of showing a message");
      await page
        .locator("text=/komandanızdan ayrılmalısınız/")
        .first()
        .waitFor({ timeout: 15_000 });
    } finally {
      await prisma.teamMembership.delete({ where: { id: membership.id } });
    }
  });

  console.log("\nAdmin approval and the merge\n");

  await check("an admin approves the claim", async () => {
    await loginAdmin(page);
    await gotoPage(page, `${BASE}/admin/claims`);
    const body = await visibleText(page);
    assert(body.includes(SHELL_NICK) && body.includes(CLAIMANT_NICK), "the claim is missing from the admin list");
    await submitForm(page, 'form:has(button:has-text("Təsdiqlə və birləşdir"))', "Təsdiqlə və birləşdir");
  });

  await check("the claimant row is deleted and the target profile survives", async () => {
    const gone = await prisma.player.findUnique({ where: { id: claimant.id } });
    assert(!gone, "the claimant row is still there");
    const target = await prisma.player.findUnique({ where: { id: shell.id } });
    assert(target, "the target profile is gone — the merge ran backwards");
  });

  await check("email, password and isClaimed move to the target profile", async () => {
    const target = await prisma.player.findUniqueOrThrow({ where: { id: shell.id } });
    assert(target.email === CLAIMANT_EMAIL, `email did not move: ${target.email}`);
    assert(target.passwordHash === hash, "the password hash did not move");
    assert(target.isClaimed, "the target profile still counts as unclaimed");
    assert(target.emailVerified, "emailVerified did not move");
  });

  await check("points are summed (7 + 5 = 12)", async () => {
    const target = await prisma.player.findUniqueOrThrow({ where: { id: shell.id } });
    assert(target.points === 12, `points ${target.points} — expected 12`);
  });

  await check("the prediction moves to the target profile", async () => {
    const moved = await prisma.matchPrediction.findFirst({ where: { matchId: match.id, playerId: shell.id } });
    assert(moved, "the prediction was not moved");
    const orphan = await prisma.matchPrediction.findFirst({ where: { playerId: claimant.id } });
    assert(!orphan, "a prediction is still attached to the claimant");
  });

  await check("the claim record becomes APPROVED and points at the target", async () => {
    const claim = await prisma.profileClaim.findFirstOrThrow({ where: { playerId: shell.id } });
    assert(claim.status === "APPROVED", `status ${claim.status}`);
    assert(claim.claimantId === shell.id, "the claim record points at the deleted row");
    assert(claim.reviewedAt, "reviewedAt was not written");
  });

  console.log("\nSigning in after the merge\n");

  await check("the claimant signs in with the same password and lands on the merged profile", async () => {
    await loginClaimant();
    const body = await visibleText(page);
    assert(body.includes(SHELL_NICK), `the panel shows the old nickname, expected: ${SHELL_NICK}`);
    assert(!body.includes(CLAIMANT_NICK), "the old nickname is still visible");
  });

  await check("the merged profile's public page opens", async () => {
    const target = await prisma.player.findUniqueOrThrow({ where: { id: shell.id } });
    const res = await gotoPage(page, `${BASE}/az/players/${target.slug}`);
    assert(res && res.status() === 200, `HTTP ${res?.status()}`);
    const body = await visibleText(page);
    assert(body.includes(SHELL_NICK), "the profile name is missing from the public page");
  });

  reportProblems(problems);
  report("Profile claims");
  await browser.close();
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
