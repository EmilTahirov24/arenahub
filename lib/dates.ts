/**
 * Saytın vaxt zonası.
 *
 * Bunsuz hər `Intl.DateTimeFormat` serverin zonasında işləyirdi — Vercel-də bu,
 * UTC-dir. Yəni Bakıda saat 13:00-da başlayan matç saytda 09:00 yazılırdı, dörd
 * saat səhv. Matç cədvəli olan bir saytda bu, ən pis səhvdir: adam gecikir və
 * səbəbini bilmir.
 *
 * Ölçülüb (2026-08-29, canlı sayt): `2026-08-29T09:00:00.000Z` matçı səhifədə
 * «09:00», ÖZ paylaşım şəklində isə «13:00» görünürdü — çünki
 * `opengraph-image.tsx` bu qərarı artıq bir dəfə vermişdi və `Asia/Baku`
 * yazırdı. İndi hər yer həmin qərarı paylaşır.
 *
 * Azərbaycan 2016-dan yay vaxtına keçmir, yəni offset ilboyu +04:00-dır. Buna
 * baxmayaraq formatlama `timeZone` ilə gedir, sabit rəqəmlə yox — qayda dəyişsə,
 * tək yerdə düzəlir.
 */
export const SITE_TIME_ZONE = "Asia/Baku";

/** Bakı vaxtına görə `YYYY-MM-DD`. */
export function toDateKey(date: Date) {
  // `en-CA` qəsdən seçilib: yeganə geniş yayılmış dil kodu ki, nəticəni məhz
  // `YYYY-MM-DD` verir və əl ilə yığmaq lazım gəlmir.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SITE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * `?date=` parametrinin həqiqətən bir gün olub-olmadığını yoxlayır.
 *
 * Bunsuz `?date=abc` ünvanı `dayRange`-dən `Invalid Date` alırdı, Prisma isə
 * onu ISO-ya çevirməyə çalışıb `RangeError` atırdı. Nəticədə /results və
 * /matches səhifələrinin siyahı hissəsi ictimai ünvanla sındırıla bilirdi
 * (qabıq 200 qaytarır, ona görə xəta HTTP kodunda görünmür — axında görünür).
 *
 * Geri çevirib tutuşdurma qəsdəndir: `2026-02-31` Node-da xəta vermir,
 * səssizcə 3 Marta sürüşür və adam istəmədiyi günün nəticələrini görür.
 *
 * İkinci fayda: `upcomingMatches`/`finishedMatches` keşi arqumentlərlə
 * açarlanır. Yoxlanmasa, hər uydurma tarix ayrıca keş qeydi yaradır və keş
 * sonsuz şişir.
 */
export function isDateKey(value: string | undefined): value is string {
  if (!value || !DATE_KEY.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000+04:00`);
  return !Number.isNaN(parsed.getTime()) && toDateKey(parsed) === value;
}

/**
 * Həmin BAKI gününün başlanğıcı və sonu, UTC anı kimi.
 *
 * Əvvəl sərhədlər UTC yarımgecəsindən götürülürdü, yəni Bakı vaxtı ilə gecə
 * 00:00–04:00 arasındakı matçlar bir əvvəlki günə düşürdü. Adam «bu gün»
 * zolağına basıb öz gecəsinin matçını görmürdü.
 */
export function dayRange(dateKey: string) {
  const start = new Date(`${dateKey}T00:00:00.000+04:00`);
  const end = new Date(`${dateKey}T23:59:59.999+04:00`);
  return { start, end };
}

/** Filtr zolağı üçün günlər — mərkəzində Bakı vaxtı ilə bu gün. */
export function dateStrip(centerOffsetDays = 0, length = 7) {
  // Bugünün Bakı tarixi götürülür, sonra həmin günün Bakı yarımgecəsindən
  // sayılır. `setUTCHours(0,...)` işləmirdi: o, UTC gününü sıfırlayırdı və
  // Bakıda saat 04:00-dan əvvəl zolaq bir gün geridə qalırdı.
  const todayKey = toDateKey(new Date());
  const anchor = dayRange(todayKey).start;

  return Array.from({ length }).map((_, i) => {
    const d = new Date(anchor);
    d.setUTCDate(d.getUTCDate() - Math.floor(length / 2) + centerOffsetDays + i);
    return d;
  });
}

/**
 * Saytın standart tarix/vaxt formatlayıcısı.
 *
 * Birbaşa `new Intl.DateTimeFormat(...)` yazmaq əvəzinə bu işlədilir ki,
 * `timeZone`-u yazmağı unutmaq mümkün olmasın — səhv məhz belə yaranmışdı.
 */
export function siteFormat(locale: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(locale, { timeZone: SITE_TIME_ZONE, ...options });
}
