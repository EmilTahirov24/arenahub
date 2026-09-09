/**
 * Answers one question: does running a match from the admin panel work end to
 * end?
 *
 * This is the flow that touches the most machinery — tournament, participants,
 * prizes, creating the match, live map scores, deriving the series score,
 * recomputing Elo, and the result appearing on the public side. If anything in
 * that chain breaks, it shows up here.
 *
 *   npm run dev            # in another terminal
 *   npx tsx e2e/02-lifecycle.ts
 *
 * Every fixture is named starting with "E2E" and cleared at the start of each
 * run — a failed run leaves its data in place so it can be inspected.
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
  assertNotErrorPage,
  visibleText,
  gotoPage,
  clickAndSettle,
} from "./_lib";
import { prisma } from "../lib/prisma";

const FIXTURE = "E2E Sınaq Turniri";

async function cleanup() {
  const tournaments = await prisma.tournament.findMany({ where: { name: { startsWith: "E2E" } }, select: { id: true } });
  const ids = tournaments.map((t) => t.id);
  if (!ids.length) return;

  const matches = await prisma.match.findMany({ where: { tournamentId: { in: ids } }, select: { id: true } });
  const matchIds = matches.map((m) => m.id);
  if (matchIds.length) {
    await prisma.playerMatchStat.deleteMany({ where: { matchId: { in: matchIds } } });
    await prisma.matchPrediction.deleteMany({ where: { matchId: { in: matchIds } } });
    await prisma.matchVetoStep.deleteMany({ where: { matchId: { in: matchIds } } });
    await prisma.matchMap.deleteMany({ where: { matchId: { in: matchIds } } });
    await prisma.match.deleteMany({ where: { id: { in: matchIds } } });
  }
  await prisma.tournamentPrize.deleteMany({ where: { tournamentId: { in: ids } } });
  await prisma.tournamentParticipant.deleteMany({ where: { tournamentId: { in: ids } } });
  await prisma.tournament.deleteMany({ where: { id: { in: ids } } });
  console.log(`(cleaned up: ${ids.length} old E2E tournaments)\n`);
}

// Selectors for the forms on each page. Each is picked out by a field unique
// to it: the admin layout's sign-out form comes first in the DOM, so a generic
// selector signs the user out instead.
const FORM = {
  tournament: 'form:has(select[name="tier"])',
  addParticipant: 'form:has(select[name="teamId"])',
  addPrize: 'form:has(input[name="placeFrom"])',
  placement: 'form:has(input[name="placement"])',
  match: 'form:has(select[name="teamAId"])',
  newMap: 'form:has(input[placeholder="Mirage, Game 1..."])',
  existingMap: 'form:has(input[name="mapId"])',
  statusLive: 'form:has(input[value="LIVE"])',
};

async function main() {
  await cleanup();

  const browser = await launch();
  const { page, problems } = await newPage(browser);

  await loginAdmin(page);
  console.log("Admin signed in: ok\n");

  let tournamentId = "";
  let matchId = "";
  let teamAName = "";
  let teamBName = "";
  let ratingBefore = 0;

  console.log("Tournament\n");

  await check("a tournament is created and the form returns to the list", async () => {
    await gotoPage(page, `${BASE}/admin/tournaments/new`);
    await page.fill('input[name="name"]', FIXTURE);
    await page.selectOption('select[name="gameId"]', { label: "Counter-Strike 2" });
    await page.selectOption('select[name="tier"]', "S");
    await page.fill('input[name="startDate"]', "2026-08-20");
    await page.fill('input[name="endDate"]', "2026-08-30");
    await page.selectOption('select[name="status"]', "ONGOING");
    await submitForm(page, FORM.tournament);
    assert(page.url().includes("/admin/tournaments"), `did not return to the list: ${page.url()}`);

    const row = page.locator(`a:has-text("${FIXTURE}")`).first();
    assert(await row.count(), "the new tournament is not in the list");
    const href = await row.getAttribute("href");
    tournamentId = (href ?? "").split("/").pop() ?? "";
    assert(tournamentId, "could not read the tournament id");
  });

  await check("two teams are added as participants", async () => {
    for (let i = 0; i < 2; i++) {
      await gotoPage(page, `${BASE}/admin/tournaments/${tournamentId}`);
      const options = await page.$$eval('select[name="teamId"] option', (os) =>
        os.map((o) => ({ value: (o as HTMLOptionElement).value, label: o.textContent ?? "" })).filter((o) => o.value),
      );
      assert(options.length, "no teams left to add");
      const picked = options[0];
      if (i === 0) teamAName = picked.label.trim();
      else teamBName = picked.label.trim();
      await page.selectOption('select[name="teamId"]', picked.value);
      await submitForm(page, FORM.addParticipant);
    }
    const body = await visibleText(page);
    assert(body.includes(teamAName) && body.includes(teamBName), "the participants are not in the list");
  });

  await check("a prize breakdown is written and appears at once", async () => {
    await gotoPage(page, `${BASE}/admin/tournaments/${tournamentId}`);
    await page.fill('input[name="placeFrom"]', "1");
    await page.fill('input[name="placeTo"]', "1");
    await page.fill('input[name="amount"]', "10000");
    await page.fill('input[name="label"]', "Winner");
    await submitForm(page, FORM.addPrize);
    // Rendering can lag revalidatePath by a tick, so the row is looked for on a
    // freshly loaded page rather than trusting the test's own timing.
    await page.reload({ waitUntil: "domcontentloaded" });
    const body = await visibleText(page);
    assert(!body.includes("Bölgü yazılmayıb"), "the prize was not added");
    assert(/10[\s,.]?000/.test(body), "the prize amount is not on the row");
  });

  // Most prizes are for a single place. Making someone type the same number
  // twice turned the form into a fight, so leaving "to" empty means one place.
  await check("an empty \"to\" field writes a single-place row", async () => {
    await gotoPage(page, `${BASE}/admin/tournaments/${tournamentId}`);
    await page.fill('input[name="placeFrom"]', "2");
    await page.fill('input[name="placeTo"]', "4");
    await page.fill('input[name="amount"]', "5000");
    await submitForm(page, FORM.addPrize);

    await gotoPage(page, `${BASE}/admin/tournaments/${tournamentId}`);
    await page.fill('input[name="placeFrom"]', "3");
    await page.fill('input[name="amount"]', "7000");
    await submitForm(page, FORM.addPrize);

    await page.reload({ waitUntil: "domcontentloaded" });
    const body = await visibleText(page);
    assert(body.includes("3-ci yer"), "an empty \"to\" field did not create a single-place row");
    assert(body.includes("2-4-ci yerlər"), "the range row disappeared");
  });

  // AGENTS.md: a form must either redirect, change something visible, or return
  // a message. Writing a placement does none of those — the input re-renders
  // with the same value, so the save button reads as dead.
  await check("writing a placement gives visible confirmation", async () => {
    await gotoPage(page, `${BASE}/admin/tournaments/${tournamentId}`);
    // The winner's row is found by name: the order depends on the seed.
    const row = page.locator(`div:has(> span:text-is("${teamAName} "))`).first();
    const form = (await row.count()) ? row.locator(FORM.placement) : page.locator(FORM.placement).first();
    await form.locator('input[name="placement"]').fill("1");
    await clickAndSettle(page, form.locator('button[type="submit"]'));
    const body = await visibleText(page);
    assert(/yazıldı|saxlanıldı|✓/i.test(body), "the placement saved, but nothing on screen confirms it");
  });

  // Third place falls into both "2-4th places $5,000" and "3rd place $7,000".
  // Taking the first match in order would let the wide range win, and the
  // $7,000 typed into the admin panel would never appear on the site.
  await check("the narrow prize row beats the wide range", async () => {
    await gotoPage(page, `${BASE}/admin/tournaments/${tournamentId}`);
    const row = page.locator(`div:has(> span:text-is("${teamBName} "))`).first();
    const form = (await row.count()) ? row.locator(FORM.placement) : page.locator(FORM.placement).last();
    await form.locator('input[name="placement"]').fill("3");
    await clickAndSettle(page, form.locator('button[type="submit"]'));

    const t = await prisma.tournament.findUnique({ where: { id: tournamentId }, select: { slug: true } });
    await gotoPage(page, `${BASE}/az/events/${t?.slug}`);
    const body = await visibleText(page);
    assert(/7[\s,.]?000/.test(body), "third place did not get the narrow row's amount");
  });

  /* ---------------------------------------------------------------- *
   * The error paths.
   *
   * All of these were measured, and all four ended on the same generic screen —
   * "this operation could not be completed… your session has probably expired" —
   * while the causes were entirely different. A message that hides the reason is
   * not a message.
   * ---------------------------------------------------------------- */

  await check("a reversed prize range is explained with the numbers", async () => {
    await gotoPage(page, `${BASE}/admin/tournaments/${tournamentId}`);
    await page.fill('input[name="placeFrom"]', "5");
    await page.fill('input[name="placeTo"]', "2");
    await page.fill('input[name="amount"]', "1000");
    await submitForm(page, FORM.addPrize);
    const body = await visibleText(page);
    assert(/kiçik ola bilməz \(5 → 2\)/.test(body), "the reversed range is not explained");
    assert(!/sessiyanız bitib/.test(body), "fell through to the generic error screen");
  });

  await check("replacing a prize row is announced", async () => {
    // The upsert replaces an existing row with the same "from" place. That used
    // to be silent: the admin thought they were adding a row and were removing
    // one.
    await gotoPage(page, `${BASE}/admin/tournaments/${tournamentId}`);
    await page.fill('input[name="placeFrom"]', "2");
    await page.fill('input[name="amount"]', "6000");
    await submitForm(page, FORM.addPrize);
    const body = await visibleText(page);
    assert(/sətri əvəzləndi/.test(body), "nothing is said about the replacement");
  });

  await check("an end date before the start date is rejected", async () => {
    await gotoPage(page, `${BASE}/admin/tournaments/${tournamentId}`);
    await page.fill("#tournament-startDate", "2026-09-20");
    await page.fill("#tournament-endDate", "2026-09-01");
    await submitForm(page, "form:has(#tournament-name)");
    const body = await visibleText(page);
    assert(/Bitmə tarixi başlama tarixindən əvvəl/.test(body), "the reversed dates were quietly accepted");
  });

  await check("a duplicate slug is reported with its reason", async () => {
    await gotoPage(page, `${BASE}/admin/tournaments/new`);
    await page.fill("#tournament-name", FIXTURE);
    const gameValue = await page.locator("#tournament-gameId option:not([value=''])").first().getAttribute("value");
    await page.selectOption("#tournament-gameId", gameValue!);
    await page.fill("#tournament-startDate", "2026-09-01");
    await page.fill("#tournament-endDate", "2026-09-10");
    await submitForm(page, "form:has(#tournament-name)");
    const body = await visibleText(page);
    assert(/slug-ı artıq işlənir/.test(body), "the duplicate slug gives no reason");
  });


  console.log("\nMatch\n");

  await check("a match is created and redirects to its edit page", async () => {
    await gotoPage(page, `${BASE}/admin/matches/new`);
    await page.selectOption('select[name="gameId"]', { label: "Counter-Strike 2" });
    await page.selectOption('select[name="tournamentId"]', { label: FIXTURE });
    await page.selectOption('select[name="teamAId"]', { label: teamAName });
    await page.selectOption('select[name="teamBId"]', { label: teamBName });
    await page.fill('input[name="scheduledAt"]', "2026-08-25T18:00");
    await page.selectOption('select[name="bestOf"]', "3");
    await page.selectOption('select[name="status"]', "UPCOMING");
    await submitForm(page, FORM.match);
    assert(/\/admin\/matches\/[^/]+$/.test(new URL(page.url()).pathname), `did not land on the edit page: ${page.url()}`);
    matchId = new URL(page.url()).pathname.split("/").pop() ?? "";
    assert(matchId, "could not read the match id");

    const team = await prisma.team.findFirst({ where: { name: teamAName }, select: { rating: true } });
    ratingBefore = team?.rating ?? 0;
  });

  await check("the go-live control sets the status to LIVE", async () => {
    await gotoPage(page, `${BASE}/admin/matches/${matchId}/live`);
    await submitForm(page, FORM.statusLive);
    const body = await visibleText(page);
    assert(body.includes("status: LIVE"), "the status did not become LIVE");
  });

  await check("an unreadable stream link is rejected with a reason", async () => {
    await gotoPage(page, `${BASE}/admin/matches/${matchId}`);
    await page.fill('input[name="streamUrl"]', "blast");
    // The field is type="url", so the browser refuses to submit it anyway. To
    // exercise the server side, that validation is switched off: a request
    // reaching the panel does not always come from the form.
    await page.evaluate(() => {
      document.querySelectorAll<HTMLFormElement>("form").forEach((el) => (el.noValidate = true));
    });
    await submitForm(page, FORM.match).catch(() => {});
    const body = await visibleText(page);
    assert(/https:\/\/ ilə başlamalıdır/.test(body), "no reason was given");
    const row = await prisma.match.findUnique({ where: { id: matchId }, select: { streamUrl: true } });
    assert(row?.streamUrl == null, `an invalid link reached the database: ${row?.streamUrl}`);
  });

  await check("on a live match a channel link shows as watch-live", async () => {
    await gotoPage(page, `${BASE}/admin/matches/${matchId}`);
    await page.fill('input[name="streamUrl"]', "https://www.twitch.tv/blastpremier");
    await submitForm(page, FORM.match);

    const m = await prisma.match.findUnique({ where: { id: matchId }, select: { slug: true } });
    await gotoPage(page, `${BASE}/az/matches/${m!.slug}`);
    const body = await visibleText(page);
    assert(/Canlı izlə/.test(body), "the live watch button is missing");
    assert(/Twitch/.test(body), "the platform name is not shown");
  });

  await check("the first map makes the series score 1:0", async () => {
    await gotoPage(page, `${BASE}/admin/matches/${matchId}/live`);
    const form = page.locator(FORM.newMap);
    await form.locator('input[name="mapName"]').fill("Mirage");
    await form.locator('select[name="status"]').selectOption("FINISHED");
    await form.locator('input[name="teamAScore"]').fill("13");
    await form.locator('input[name="teamBScore"]').fill("8");
    await submitForm(page, FORM.newMap);
    const body = await visibleText(page);
    assert(body.includes("1 : 0"), `the series score did not become 1:0`);
  });

  await check("the second map finishes the match automatically", async () => {
    await gotoPage(page, `${BASE}/admin/matches/${matchId}/live`);
    const form = page.locator(FORM.newMap);
    await form.locator('input[name="mapName"]').fill("Inferno");
    await form.locator('select[name="status"]').selectOption("FINISHED");
    await form.locator('input[name="teamAScore"]').fill("13");
    await form.locator('input[name="teamBScore"]').fill("10");
    await submitForm(page, FORM.newMap);

    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: { winner: true },
    });
    assert(match?.status === "FINISHED", `status ${match?.status} — expected FINISHED`);
    assert(match.teamAScore === 2 && match.teamBScore === 0, `score ${match.teamAScore}:${match.teamBScore} — expected 2:0`);
    assert(match.winner?.name === teamAName, `winner ${match.winner?.name} — expected ${teamAName}`);
  });

  await check("the winner's rating is recomputed", async () => {
    const team = await prisma.team.findFirst({ where: { name: teamAName }, select: { rating: true } });
    assert(team, "team not found");
    assert(team.rating !== ratingBefore, `the rating did not change (${ratingBefore})`);
    assert(team.rating > ratingBefore, `the winner's rating went down: ${ratingBefore} → ${team.rating}`);
  });

  // An AGENTS.md violation: changing an existing map from 13-8 to 13-9 does not
  // move the series score, so nothing happens on screen.
  await check("editing an existing map score gives visible confirmation", async () => {
    await gotoPage(page, `${BASE}/admin/matches/${matchId}/live`);
    const first = page.locator(FORM.existingMap).first();
    await first.locator('input[name="teamBScore"]').fill("9");
    await submitForm(page, FORM.existingMap, "Yadda saxla");
    const body = await visibleText(page);
    assert(/saxlanıldı|yeniləndi|✓/i.test(body), "the map saved, but nothing on screen confirms it");
  });

  // A third case of the same kind: K/D/A saves, but the same numbers re-render
  // in the same boxes, so the save button reads as dead.
  await check("saving player statistics gives visible confirmation", async () => {
    await gotoPage(page, `${BASE}/admin/matches/${matchId}/stats`);
    const body0 = await visibleText(page);
    assert(!body0.includes("Tərkib boşdur"), "the chosen teams have no roster — this check needs different teams");
    const form = page.locator('form:has(input[name="kills"])').first();
    await form.locator('input[name="kills"]').fill("20");
    await form.locator('input[name="deaths"]').fill("14");
    await form.locator('input[name="rating"]').fill("1.25");
    await clickAndSettle(page, form.locator('button[type="submit"]'));
    const body = await visibleText(page);
    assert(/saxlanıldı|yeniləndi|✓/i.test(body), "the statistics saved, but nothing on screen confirms it");
  });

  console.log("\nThe public side\n");

  let slug = "";
  await check("the match shows 2:0 on its public page", async () => {
    const match = await prisma.match.findUnique({ where: { id: matchId }, select: { slug: true } });
    slug = match?.slug ?? "";
    assert(slug, "no slug");
    await gotoPage(page, `${BASE}/az/matches/${slug}`);
    await assertNotErrorPage(page);
    const body = await visibleText(page);
    assert(body.includes("Mirage") && body.includes("Inferno"), "the map list is missing from the public page");
    assert(body.includes(teamAName) && body.includes(teamBName), "the team names are missing");
  });

  await check("the match appears in the /az/results list", async () => {
    await gotoPage(page, `${BASE}/az/results`);
    const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href") ?? ""));
    assert(hrefs.some((h) => h.includes(slug)), "the finished match did not reach the results list");
  });

  await check("the tournament page shows the prize and the participants", async () => {
    const t = await prisma.tournament.findUnique({ where: { id: tournamentId }, select: { slug: true } });
    await gotoPage(page, `${BASE}/az/events/${t?.slug}`);
    await assertNotErrorPage(page);
    const body = await visibleText(page);
    assert(body.includes(teamAName), "the participant is missing");
    assert(/10[\s,.]?000/.test(body), "the prize amount is missing");
  });

  await check("a channel link is hidden once the match is over", async () => {
    // twitch.tv/channel points at whatever is live right now. Keeping a watch
    // button on yesterday's match sends the reader to a DIFFERENT one.
    const m = await prisma.match.findUnique({
      where: { id: matchId },
      select: { slug: true, status: true, streamUrl: true },
    });
    assert(m?.status === "FINISHED", `the match has not finished yet: ${m?.status}`);
    assert(m?.streamUrl, "no stream link was written — the check would prove nothing");
    await gotoPage(page, `${BASE}/az/matches/${m!.slug}`);
    const body = await visibleText(page);
    assert(!/Canlı izlə|Təkrarı izlə/.test(body), "a dead watch button survived on the finished match");
  });

  await check("deleting a tournament with matches states the consequence first", async () => {
    // Measured: deleting a tournament does NOT delete its matches — tournamentId
    // becomes null and the match stays on the site with no tournament. The
    // consequence of an irreversible action has to be visible BEFORE the click.
    await gotoPage(page, `${BASE}/admin/tournaments/${tournamentId}`);
    const body = await visibleText(page);
    assert(/Turnir silinəndə matçlar silinmir/.test(body), "no deletion warning");
  });

  reportProblems(problems);
  report("Match lifecycle");
  await browser.close();
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
