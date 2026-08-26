import type { PrismaClient } from "../app/generated/prisma/client";

/** İdxal susanda bunu problem saymaq üçün hədd. */
export const IMPORT_STALE_AFTER_MINUTES = 180;

/** Prisma client-i parametr kimi alırıq: skriptlərin öz bağlantısı var. */
type Db = Pick<PrismaClient, "importRun">;

/**
 * İdxal skriptini qeyd altında işlədir.
 *
 * Uğurlu qaçış heç bir iz qoymurdu, ona görə "idxal işləyirmi?" sualının cavabı
 * yalnız GitHub Actions səhifəsində idi — orada isə heç kim baxmır. Uğursuzluq
 * da, "yaşıl qaçdı, amma heç nə yazmadı" halı da eyni dərəcədə görünməz qalırdı.
 *
 * Qeyd hər iki halda yazılır: xəta atılsa `ok` false olur və mətn saxlanılır,
 * sonra xəta yenidən atılır ki, iş axını da qırmızı olsun.
 */
export async function recordImportRun<T extends { written: number; note?: string }>(
  db: Db,
  script: string,
  run: () => Promise<T>,
): Promise<T> {
  const started = new Date();
  try {
    const result = await run();
    await db.importRun.create({
      data: {
        script,
        startedAt: started,
        finishedAt: new Date(),
        ok: true,
        written: result.written,
        note: result.note ?? null,
      },
    });
    return result;
  } catch (e) {
    const note = e instanceof Error ? e.message.slice(0, 500) : String(e).slice(0, 500);
    // Qeydin özü sınsa, əsl xətanı gizlətməsin.
    await db.importRun
      .create({ data: { script, startedAt: started, finishedAt: new Date(), ok: false, note } })
      .catch(() => {});
    throw e;
  }
}

export type ImportHealth = {
  lastOkAt: Date | null;
  minutesSinceOk: number | null;
  stale: boolean;
  lastOk: boolean | null;
  lastWritten: number | null;
  lastNote: string | null;
};

/** Admin panelinin göstərdiyi vəziyyət. */
export async function importHealth(db: Db, script = "import-live"): Promise<ImportHealth> {
  const [last, lastOk] = await Promise.all([
    db.importRun.findFirst({ where: { script }, orderBy: { startedAt: "desc" } }),
    db.importRun.findFirst({ where: { script, ok: true }, orderBy: { startedAt: "desc" } }),
  ]);

  const minutesSinceOk = lastOk
    ? Math.floor((Date.now() - lastOk.startedAt.getTime()) / 60_000)
    : null;

  return {
    lastOkAt: lastOk?.startedAt ?? null,
    minutesSinceOk,
    // Heç vaxt qaçmayıbsa da problemdir — cədvəl boş qalmamalıdır.
    stale: minutesSinceOk === null || minutesSinceOk > IMPORT_STALE_AFTER_MINUTES,
    lastOk: last?.ok ?? null,
    lastWritten: last?.written ?? null,
    lastNote: last?.note ?? null,
  };
}
