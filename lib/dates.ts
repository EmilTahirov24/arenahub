export function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
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
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && toDateKey(parsed) === value;
}

export function dayRange(dateKey: string) {
  const start = new Date(`${dateKey}T00:00:00.000Z`);
  const end = new Date(`${dateKey}T23:59:59.999Z`);
  return { start, end };
}

export function dateStrip(centerOffsetDays = 0, length = 7) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - Math.floor(length / 2) + centerOffsetDays);

  return Array.from({ length }).map((_, i) => {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    return d;
  });
}
