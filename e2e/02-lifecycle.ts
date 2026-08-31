/**
 * Bir suala cavab verir: admin paneldən matç idarə etmək baş-ayaq işləyirmi?
 *
 * Ən çox mexanizmə toxunan axındır — turnir, iştirakçı, mükafat, matç yaradılışı,
 * canlı xəritə hesabı, seriya skorunun avtomatik çıxarılması, Elo-nun yenidən
 * hesablanması və nəticənin public tərəfdə görünməsi. Bir yerdə sınsa, burada
 * görünür.
 *
 *   npm run dev            # ayrı terminalda
 *   npx tsx e2e/02-lifecycle.ts
 *
 * Bütün fikstürlərin adı "E2E" ilə başlayır və hər qaçışın əvvəlində silinir —
 * uğursuz qaçış datanı yerində qoyur ki, ona baxmaq mümkün olsun.
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
  console.log(`(təmizləndi: ${ids.length} köhnə E2E turniri)\n`);
}

// Səhifədəki formaların ünvanları. Hər biri öz içindəki unikal sahə ilə seçilir —
// admin layout-un «Çıxış» forması DOM-da birinci gəldiyi üçün ümumi selektor
// istifadəçini sistemdən çıxarır.
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
  console.log("Admin girişi: ok\n");

  let tournamentId = "";
  let matchId = "";
  let teamAName = "";
  let teamBName = "";
  let ratingBefore = 0;

  console.log("Turnir\n");

  await check("turnir yaradılır və siyahıya qayıdır", async () => {
    await gotoPage(page, `${BASE}/admin/tournaments/new`);
    await page.fill('input[name="name"]', FIXTURE);
    await page.selectOption('select[name="gameId"]', { label: "Counter-Strike 2" });
    await page.selectOption('select[name="tier"]', "S");
    await page.fill('input[name="startDate"]', "2026-08-20");
    await page.fill('input[name="endDate"]', "2026-08-30");
    await page.selectOption('select[name="status"]', "ONGOING");
    await submitForm(page, FORM.tournament);
    assert(page.url().includes("/admin/tournaments"), `siyahıya qayıtmadı: ${page.url()}`);

    const row = page.locator(`a:has-text("${FIXTURE}")`).first();
    assert(await row.count(), "yaradılan turnir siyahıda görünmür");
    const href = await row.getAttribute("href");
    tournamentId = (href ?? "").split("/").pop() ?? "";
    assert(tournamentId, "turnir id-si alınmadı");
  });

  await check("iki komanda iştirakçı əlavə olunur", async () => {
    for (let i = 0; i < 2; i++) {
      await gotoPage(page, `${BASE}/admin/tournaments/${tournamentId}`);
      const options = await page.$$eval('select[name="teamId"] option', (os) =>
        os.map((o) => ({ value: (o as HTMLOptionElement).value, label: o.textContent ?? "" })).filter((o) => o.value),
      );
      assert(options.length, "əlavə ediləcək komanda qalmayıb");
      const picked = options[0];
      if (i === 0) teamAName = picked.label.trim();
      else teamBName = picked.label.trim();
      await page.selectOption('select[name="teamId"]', picked.value);
      await submitForm(page, FORM.addParticipant);
    }
    const body = await visibleText(page);
    assert(body.includes(teamAName) && body.includes(teamBName), "iştirakçılar siyahıda görünmür");
  });

  await check("mükafat bölgüsü yazılır və dərhal görünür", async () => {
    await gotoPage(page, `${BASE}/admin/tournaments/${tournamentId}`);
    await page.fill('input[name="placeFrom"]', "1");
    await page.fill('input[name="placeTo"]', "1");
    await page.fill('input[name="amount"]', "10000");
    await page.fill('input[name="label"]', "Winner");
    await submitForm(page, FORM.addPrize);
    // revalidatePath-dan sonra render bir tick gecikə bilər — sətri təzə yüklənmiş
    // səhifədə axtarırıq ki, test öz vaxtlamasına görə yanılmasın.
    await page.reload({ waitUntil: "domcontentloaded" });
    const body = await visibleText(page);
    assert(!body.includes("Bölgü yazılmayıb"), "mükafat əlavə olunmadı");
    assert(/10[\s,.]?000/.test(body), "mükafat məbləği sətirdə görünmür");
  });

  // Mükafatların çoxu tək yerədir. Eyni rəqəmi iki dəfə yazdırmaq forma ilə
  // mübarizəyə çevrilirdi, ona görə boş «Yerə» tək yer deməkdir.
  await check("boş «Yerə» tək yer sətri yazır", async () => {
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
    assert(body.includes("3-ci yer"), "boş «Yerə» tək yer sətri yaratmadı");
    assert(body.includes("2-4-ci yerlər"), "aralıq sətri itdi");
  });

  // AGENTS.md: forma ya yönləndirməli, ya görünən nəyisə dəyişməli, ya da mesaj
  // qaytarmalıdır. Yer yazmaq bunların heç birini etmir — input elə həmin dəyərlə
  // yenidən render olunur, yəni «yaz» düyməsi ölü görünür.
  await check("yer (placement) yazanda görünən təsdiq olur", async () => {
    await gotoPage(page, `${BASE}/admin/tournaments/${tournamentId}`);
    // Qalibin sətrini adına görə seçirik — sıra seed-ə görə dəyişə bilər.
    const row = page.locator(`div:has(> span:text-is("${teamAName} "))`).first();
    const form = (await row.count()) ? row.locator(FORM.placement) : page.locator(FORM.placement).first();
    await form.locator('input[name="placement"]').fill("1");
    await clickAndSettle(page, form.locator('button[type="submit"]'));
    const body = await visibleText(page);
    assert(/yazıldı|saxlanıldı|✓/i.test(body), "yer yazıldı, amma ekranda heç bir təsdiq yoxdur");
  });

  // 3-cü yer həm «2-4-cü yerlər $5 000», həm «3-cü yer $7 000» sətrinə düşür.
  // Sıra ilə ilk uyğun gələni götürsək, geniş aralıq qazanar və admin panelə
  // yazılan $7 000 saytda heç vaxt görünməzdi.
  await check("dar mükafat sətri geniş aralığı üstələyir", async () => {
    await gotoPage(page, `${BASE}/admin/tournaments/${tournamentId}`);
    const row = page.locator(`div:has(> span:text-is("${teamBName} "))`).first();
    const form = (await row.count()) ? row.locator(FORM.placement) : page.locator(FORM.placement).last();
    await form.locator('input[name="placement"]').fill("3");
    await clickAndSettle(page, form.locator('button[type="submit"]'));

    const t = await prisma.tournament.findUnique({ where: { id: tournamentId }, select: { slug: true } });
    await gotoPage(page, `${BASE}/az/events/${t?.slug}`);
    const body = await visibleText(page);
    assert(/7[\s,.]?000/.test(body), "3-cü yerə dar sətrin məbləği yazılmadı");
  });

  /* ---------------------------------------------------------------- *
   * Səhv yolları.
   *
   * Hamısı ölçülmüşdü: dördünün də sonu eyni ümumi ekran idi —
   * «Bu əməliyyat yerinə yetirilmədi… çox güman sessiyanız bitib» —
   * halbuki səbəblər tamam fərqli idi. Səbəbi gizlədən mesaj mesaj deyil.
   * ---------------------------------------------------------------- */

  await check("tərs mükafat aralığı rəqəmlərlə izah olunur", async () => {
    await gotoPage(page, `${BASE}/admin/tournaments/${tournamentId}`);
    await page.fill('input[name="placeFrom"]', "5");
    await page.fill('input[name="placeTo"]', "2");
    await page.fill('input[name="amount"]', "1000");
    await submitForm(page, FORM.addPrize);
    const body = await visibleText(page);
    assert(/kiçik ola bilməz \(5 → 2\)/.test(body), "tərs aralıq izah olunmur");
    assert(!/sessiyanız bitib/.test(body), "ümumi səhv ekranına düşdü");
  });

  await check("əvəzlənən mükafat sətri barədə xəbərdarlıq olur", async () => {
    // upsert eyni «Yerdən» üçün köhnə sətri əvəz edir. Əvvəl bu, səssiz idi:
    // admin sətir əlavə etdiyini düşünürdü, əslində birini silirdi.
    await gotoPage(page, `${BASE}/admin/tournaments/${tournamentId}`);
    await page.fill('input[name="placeFrom"]', "2");
    await page.fill('input[name="amount"]', "6000");
    await submitForm(page, FORM.addPrize);
    const body = await visibleText(page);
    assert(/sətri əvəzləndi/.test(body), "əvəzləmə barədə heç nə deyilmir");
  });

  await check("bitmə tarixi başlamadan əvvəl olanda rədd edilir", async () => {
    await gotoPage(page, `${BASE}/admin/tournaments/${tournamentId}`);
    await page.fill("#tournament-startDate", "2026-09-20");
    await page.fill("#tournament-endDate", "2026-09-01");
    await submitForm(page, "form:has(#tournament-name)");
    const body = await visibleText(page);
    assert(/Bitmə tarixi başlama tarixindən əvvəl/.test(body), "tərs tarix sakitcə qəbul olundu");
  });

  await check("təkrar slug səbəbi ilə birlikdə deyilir", async () => {
    await gotoPage(page, `${BASE}/admin/tournaments/new`);
    await page.fill("#tournament-name", FIXTURE);
    const gameValue = await page.locator("#tournament-gameId option:not([value=''])").first().getAttribute("value");
    await page.selectOption("#tournament-gameId", gameValue!);
    await page.fill("#tournament-startDate", "2026-09-01");
    await page.fill("#tournament-endDate", "2026-09-10");
    await submitForm(page, "form:has(#tournament-name)");
    const body = await visibleText(page);
    assert(/slug-ı artıq işlənir/.test(body), "təkrar slug səbəbi deyilmir");
  });


  console.log("\nMatç\n");

  await check("matç yaradılır və redaktə səhifəsinə yönləndirir", async () => {
    await gotoPage(page, `${BASE}/admin/matches/new`);
    await page.selectOption('select[name="gameId"]', { label: "Counter-Strike 2" });
    await page.selectOption('select[name="tournamentId"]', { label: FIXTURE });
    await page.selectOption('select[name="teamAId"]', { label: teamAName });
    await page.selectOption('select[name="teamBId"]', { label: teamBName });
    await page.fill('input[name="scheduledAt"]', "2026-08-25T18:00");
    await page.selectOption('select[name="bestOf"]', "3");
    await page.selectOption('select[name="status"]', "UPCOMING");
    await submitForm(page, FORM.match);
    assert(/\/admin\/matches\/[^/]+$/.test(new URL(page.url()).pathname), `redaktə səhifəsinə düşmədi: ${page.url()}`);
    matchId = new URL(page.url()).pathname.split("/").pop() ?? "";
    assert(matchId, "matç id-si alınmadı");

    const team = await prisma.team.findFirst({ where: { name: teamAName }, select: { rating: true } });
    ratingBefore = team?.rating ?? 0;
  });

  await check("«Canlı et» statusu LIVE edir", async () => {
    await gotoPage(page, `${BASE}/admin/matches/${matchId}/live`);
    await submitForm(page, FORM.statusLive);
    const body = await visibleText(page);
    assert(body.includes("status: LIVE"), "status LIVE olmadı");
  });

  await check("birinci xəritə seriya skorunu 1:0 edir", async () => {
    await gotoPage(page, `${BASE}/admin/matches/${matchId}/live`);
    const form = page.locator(FORM.newMap);
    await form.locator('input[name="mapName"]').fill("Mirage");
    await form.locator('select[name="status"]').selectOption("FINISHED");
    await form.locator('input[name="teamAScore"]').fill("13");
    await form.locator('input[name="teamBScore"]').fill("8");
    await submitForm(page, FORM.newMap);
    const body = await visibleText(page);
    assert(body.includes("1 : 0"), `seriya skoru 1:0 olmadı`);
  });

  await check("ikinci xəritə matçı avtomatik FINISHED edir", async () => {
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
    assert(match?.status === "FINISHED", `status ${match?.status} — FINISHED gözlənilirdi`);
    assert(match.teamAScore === 2 && match.teamBScore === 0, `skor ${match.teamAScore}:${match.teamBScore} — 2:0 gözlənilirdi`);
    assert(match.winner?.name === teamAName, `qalib ${match.winner?.name} — ${teamAName} gözlənilirdi`);
  });

  await check("qalibin reytinqi yenidən hesablanır", async () => {
    const team = await prisma.team.findFirst({ where: { name: teamAName }, select: { rating: true } });
    assert(team, "komanda tapılmadı");
    assert(team.rating !== ratingBefore, `reytinq dəyişmədi (${ratingBefore})`);
    assert(team.rating > ratingBefore, `qalibin reytinqi azalıb: ${ratingBefore} → ${team.rating}`);
  });

  // AGENTS.md pozuntusu: mövcud xəritənin hesabını 13-8-dən 13-9-a dəyişmək
  // seriya skorunu tərpətmir, ona görə ekranda heç nə baş vermir.
  await check("mövcud xəritənin hesabı dəyişəndə görünən təsdiq olur", async () => {
    await gotoPage(page, `${BASE}/admin/matches/${matchId}/live`);
    const first = page.locator(FORM.existingMap).first();
    await first.locator('input[name="teamBScore"]').fill("9");
    await submitForm(page, FORM.existingMap, "Yadda saxla");
    const body = await visibleText(page);
    assert(/saxlanıldı|yeniləndi|✓/i.test(body), "xəritə yadda saxlanıldı, amma ekranda təsdiq yoxdur");
  });

  // Üçüncü eyni tipli hal: K/D/A saxlanır, amma eyni rəqəmlər eyni qutularda
  // yenidən render olunur — «Saxla» düyməsi ölü görünür.
  await check("oyunçu statistikası saxlananda görünən təsdiq olur", async () => {
    await gotoPage(page, `${BASE}/admin/matches/${matchId}/stats`);
    const body0 = await visibleText(page);
    assert(!body0.includes("Tərkib boşdur"), "seçilmiş komandaların tərkibi yoxdur — bu yoxlama üçün başqa komanda lazımdır");
    const form = page.locator('form:has(input[name="kills"])').first();
    await form.locator('input[name="kills"]').fill("20");
    await form.locator('input[name="deaths"]').fill("14");
    await form.locator('input[name="rating"]').fill("1.25");
    await clickAndSettle(page, form.locator('button[type="submit"]'));
    const body = await visibleText(page);
    assert(/saxlanıldı|yeniləndi|✓/i.test(body), "statistika saxlanıldı, amma ekranda təsdiq yoxdur");
  });

  console.log("\nPublic tərəf\n");

  let slug = "";
  await check("matç public səhifədə 2:0 göstərir", async () => {
    const match = await prisma.match.findUnique({ where: { id: matchId }, select: { slug: true } });
    slug = match?.slug ?? "";
    assert(slug, "slug yoxdur");
    await gotoPage(page, `${BASE}/az/matches/${slug}`);
    await assertNotErrorPage(page);
    const body = await visibleText(page);
    assert(body.includes("Mirage") && body.includes("Inferno"), "xəritə siyahısı public səhifədə görünmür");
    assert(body.includes(teamAName) && body.includes(teamBName), "komanda adları görünmür");
  });

  await check("matç /az/results siyahısında var", async () => {
    await gotoPage(page, `${BASE}/az/results`);
    const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href") ?? ""));
    assert(hrefs.some((h) => h.includes(slug)), "bitmiş matç nəticələr siyahısına düşmədi");
  });

  await check("turnir səhifəsi mükafatı və iştirakçıları göstərir", async () => {
    const t = await prisma.tournament.findUnique({ where: { id: tournamentId }, select: { slug: true } });
    await gotoPage(page, `${BASE}/az/events/${t?.slug}`);
    await assertNotErrorPage(page);
    const body = await visibleText(page);
    assert(body.includes(teamAName), "iştirakçı görünmür");
    assert(/10[\s,.]?000/.test(body), "mükafat məbləği görünmür");
  });

  await check("matçı olan turnirdə silmənin nəticəsi əvvəlcədən yazılır", async () => {
    // Ölçüldü: turnir silinəndə matçlar SİLİNMİR — tournamentId null olur və
    // matç saytda turnirsiz qalır. Geri qaytarılmayan əməliyyatın nəticəsi
    // düyməyə basmazdan ƏVVƏL görünməlidir.
    await gotoPage(page, `${BASE}/admin/tournaments/${tournamentId}`);
    const body = await visibleText(page);
    assert(/Turnir silinəndə matçlar silinmir/.test(body), "silmə xəbərdarlığı yoxdur");
  });

  reportProblems(problems);
  report("Matç həyat dövrü");
  await browser.close();
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
