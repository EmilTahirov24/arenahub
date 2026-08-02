export function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
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
