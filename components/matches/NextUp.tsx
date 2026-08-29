import { getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import GameChip from "@/components/common/GameChip";
import { siteFormat } from "@/lib/dates";

/**
 * What to show when there is nothing scheduled and nothing live.
 *
 * Deliberately small: one line saying why the list is empty, the single nearest
 * tournament with a countdown, and a way out to the results. A full list of
 * upcoming events belongs on /events — repeating it here would make two pages
 * that say the same thing.
 */
export default async function NextUp({ reason }: { reason: "matches" | "live" }) {
  const locale = await getLocale();
  const az = locale === "az";

  const next = await prisma.tournament.findFirst({
    where: { startDate: { gt: new Date() } },
    orderBy: { startDate: "asc" },
    include: { game: true },
  });

  const explain = az
    ? reason === "live"
      ? "Hazırda canlı matç yoxdur."
      : "Təşkilatçılar hələ oyun cədvəlini dərc etməyib — açıqlanan kimi matçlar burada görünəcək."
    : reason === "live"
      ? "No live matches right now."
      : "Organisers have not published the schedule yet — matches appear here as soon as they do.";

  return (
    <div className="rounded-lg border border-border-subtle bg-surface p-6">
      <p className="text-sm text-foreground-muted">{explain}</p>

      {next && (
        <div className="mt-5 border-t border-border-subtle pt-5">
          <p className="mb-2 text-xs uppercase tracking-wide text-foreground-muted">
            {az ? "Növbəti turnir" : "Next tournament"}
          </p>
          <Link href={`/events/${next.slug}`} className="group flex flex-wrap items-center gap-3">
            <GameChip name={next.game.shortName} color={next.game.accentColor} />
            <span className="font-display text-lg font-bold group-hover:underline">{next.name}</span>
            <span className="text-sm text-foreground-muted">
              {siteFormat(locale, { day: "2-digit", month: "long" }).format(next.startDate)}
              {next.location ? ` · ${next.location}` : ""}
            </span>
          </Link>
        </div>
      )}

      <Link href="/results" className="mt-5 inline-block text-sm text-brand-via-fg hover:underline">
        {az ? "Son nəticələrə bax" : "See the latest results"} →
      </Link>
    </div>
  );
}
