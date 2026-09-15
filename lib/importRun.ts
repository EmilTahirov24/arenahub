import type { PrismaClient } from "../app/generated/prisma/client";

/**
 * How long the importer may stay quiet before that counts as a problem.
 *
 * It was 3 hours and raised false alarms. The cause is not in the
 * application: GitHub's scheduled jobs queue on the free plan. Asked for
 * every 20 minutes, the actual gaps were measured at anywhere from 45 minutes
 * to 5 hours 11 minutes. Four hours of silence is normal, not a fault.
 *
 * 6 hours was chosen: above the worst normal gap observed, yet still low
 * enough to catch a real failure (job broken, switched off, secret expired)
 * within a working day. The panel shows the exact figure anyway - this
 * threshold only decides when the red appears.
 */
export const IMPORT_STALE_AFTER_MINUTES = 360;

/** The Prisma client arrives as a parameter: the scripts hold their own connection. */
type Db = Pick<PrismaClient, "importRun">;

/**
 * Runs an import script and records what happened.
 *
 * A successful run left no trace, so the answer to "is the import working?"
 * lived only on the GitHub Actions page, where nobody looks. A failure and a
 * "ran green but wrote nothing" run were equally invisible.
 *
 * The record is written either way: on a throw, `ok` becomes false and the
 * message is kept, then the error is rethrown so the workflow goes red too.
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
    // If writing the record fails, it must not hide the error it was recording.
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

/** The state the admin panel displays. */
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
    // Never having run is a problem too - the table should not be empty.
    stale: minutesSinceOk === null || minutesSinceOk > IMPORT_STALE_AFTER_MINUTES,
    lastOk: last?.ok ?? null,
    lastWritten: last?.written ?? null,
    lastNote: last?.note ?? null,
  };
}
