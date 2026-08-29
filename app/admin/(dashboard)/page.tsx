import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { pendingClaimCount } from "@/lib/profileClaims";
import { importHealth, IMPORT_STALE_AFTER_MINUTES } from "@/lib/importRun";

export default async function AdminDashboardPage() {
  const [teams, players, matches, liveMatches, news, ads, tournaments, claims] = await Promise.all([
    prisma.team.count(),
    prisma.player.count(),
    prisma.match.count(),
    prisma.match.findMany({
      where: { status: "LIVE" },
      include: { teamA: true, teamB: true, game: true },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.newsArticle.count(),
    prisma.adBanner.count({ where: { isActive: true } }),
    prisma.tournament.count(),
    pendingClaimCount(),
  ]);

  const health = await importHealth(prisma);

  // Turnirlər və müraciətlər menyuda öz bölmələri olmasına baxmayaraq burada
  // görünmürdü. Müraciətlər xüsusilə vacibdir: gözləyən müraciət insanın
  // cavab gözlədiyi yeganə yerdir, ona görə sıfırdan böyük olanda seçilir.
  const stats = [
    { label: "Komandalar", value: teams, href: "/admin/teams", waiting: false },
    { label: "Oyunçular", value: players, href: "/admin/players", waiting: false },
    { label: "Matçlar", value: matches, href: "/admin/matches", waiting: false },
    { label: "Turnirlər", value: tournaments, href: "/admin/tournaments", waiting: false },
    { label: "Xəbərlər", value: news, href: "/admin/news", waiting: false },
    { label: "Aktiv reklamlar", value: ads, href: "/admin/ads", waiting: false },
    { label: "Gözləyən müraciətlər", value: claims, href: "/admin/claims", waiting: claims > 0 },
  ];

  const ago = (m: number) =>
    m < 60 ? `${m} dəqiqə əvvəl` : `${Math.floor(m / 60)} saat ${m % 60} dəqiqə əvvəl`;

  return (
    <div>
      <h1 className="font-display mb-6 text-2xl font-bold">Dashboard</h1>

      {/* Saytın bütün dəyəri təzə matç datasıdır, o data isə GitHub Actions-da
          qaçan bir işdən asılıdır. İş sınsa və ya söndürülsə, sayt səssizcə
          köhnəlir — səhifələr normal görünür, sadəcə heç nə dəyişmir. Vəziyyət
          burada göstərilir ki, panelə girən adam onu görməmiş ötüşməsin. */}
      <div
        className={`mb-8 rounded-lg border p-4 ${
          health.stale ? "border-live bg-live/10" : "border-border-subtle bg-surface"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-semibold">Matç idxalı</span>
          <span className={`text-sm ${health.stale ? "text-live" : "text-positive"}`}>
            {health.minutesSinceOk === null
              ? "heç vaxt qaçmayıb"
              : health.stale
                ? `${ago(health.minutesSinceOk)} — dayanmış ola bilər`
                : `son uğurlu qaçış ${ago(health.minutesSinceOk)}`}
          </span>
        </div>
        {health.lastNote && (
          <p className="mt-1 text-xs text-foreground-muted">
            {health.lastOk === false ? "Sonuncu qaçış uğursuz: " : "Sonuncu qaçış: "}
            {health.lastNote}
          </p>
        )}
        {health.stale && (
          <p className="mt-2 text-xs text-foreground-muted">
            {Math.round(IMPORT_STALE_AFTER_MINUTES / 60)} saatdan çoxdur uğurlu idxal yoxdur.
            GitHub Actions-da «Import live matches» işinə baxın. İki adi səbəb var: iş sınıb
            (qırmızı qaçış görünəcək), ya da 60 gün hərəkətsizlikdən sonra GitHub cədvəlli işləri
            özü söndürüb. Bir neçə saatlıq fasilə isə normaldır — pulsuz planda cədvəl növbəyə
            düşür.
          </p>
        )}
      </div>

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className={`rounded-lg border bg-surface p-4 hover:bg-surface-raised ${
              s.waiting ? "border-brand-via" : "border-border-subtle"
            }`}
          >
            <div className={`font-display text-2xl font-bold ${s.waiting ? "text-brand-via-fg" : ""}`}>{s.value}</div>
            <div className="text-xs text-foreground-muted">{s.label}</div>
          </Link>
        ))}
      </div>

      <h2 className="font-display mb-3 text-lg font-bold">Canlı matçlar</h2>
      {liveMatches.length === 0 ? (
        <p className="text-sm text-foreground-muted">Hazırda canlı matç yoxdur.</p>
      ) : (
        <div className="space-y-2">
          {liveMatches.map((m) => (
            <Link
              key={m.id}
              href={`/admin/matches/${m.id}/live`}
              className="flex items-center justify-between rounded-lg border border-live/40 bg-live/5 px-4 py-3 hover:bg-live/10"
            >
              <span className="text-sm">
                {m.teamA.name} vs {m.teamB.name} · {m.game.shortName}
              </span>
              <span className="font-display font-semibold">{m.teamAScore} : {m.teamBScore}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
