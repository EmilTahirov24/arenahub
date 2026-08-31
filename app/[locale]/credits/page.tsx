import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import PageShell from "@/components/layout/PageShell";
import { Link } from "@/i18n/navigation";
import { localeAlternates } from "@/lib/localeAlternates";
import { allPhotoCredits, isShareAlike } from "@/lib/playerPhotos";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    alternates: localeAlternates(locale, "/credits"),
    title: locale === "az" ? "Şəkillərin müəllifləri" : "Photo credits",
  };
}

/**
 * Attribution page for the player photographs.
 *
 * Every picture here is CC BY, CC BY-SA or CC0 from Wikimedia Commons, and the
 * first two licences REQUIRE the author to be named. A 40-pixel avatar in a
 * table cannot carry that line, so the accepted practice is followed: the
 * photographer is named beside the picture on the player's own page, and every
 * photo is listed in full here.
 *
 * The pictures are cropped to a square, which makes them derivative works. For
 * the share-alike licences that means the crop carries the same licence, and
 * those rows say so.
 */
export default async function CreditsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const az = locale === "az";
  const credits = allPhotoCredits();

  return (
    <PageShell>
      <h1 className="font-display mb-2 text-2xl font-bold">
        {az ? "Şəkillərin müəllifləri" : "Photo credits"}
      </h1>
      <p className="mb-6 max-w-2xl text-sm text-foreground-muted">
        {az ? (
          <>
            Oyunçu şəkilləri Wikimedia Commons-dandır və hər biri sərbəst lisenziya
            altındadır. Müəllifin adı lisenziyanın şərtidir. Şəkillər avatar üçün
            kvadrat kəsilib — kəsilmiş variant törəmə əsərdir, ona görə «paylaş-eyni-cür»
            lisenziyalı olanlar eyni lisenziya altında qalır.
          </>
        ) : (
          <>
            Player photographs come from Wikimedia Commons under free licences. Naming
            the author is a condition of those licences. The pictures are cropped to a
            square for use as avatars; a crop is a derivative work, so the share-alike
            ones remain under the same licence.
          </>
        )}
      </p>

      <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-surface-raised text-left text-xs uppercase tracking-wide text-foreground-muted">
            <tr>
              <th className="px-3 py-2 font-medium">{az ? "Oyunçu" : "Player"}</th>
              <th className="px-3 py-2 font-medium">{az ? "Müəllif" : "Author"}</th>
              <th className="px-3 py-2 font-medium">{az ? "Lisenziya" : "Licence"}</th>
            </tr>
          </thead>
          <tbody>
            {credits.map((c) => (
              <tr key={c.file} className="border-t border-border-subtle">
                <td className="px-3 py-2 font-medium">{c.nickname}</td>
                <td className="px-3 py-2 text-foreground-muted">
                  <a
                    href={c.source}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-foreground hover:underline"
                  >
                    {c.author}
                  </a>
                </td>
                <td className="px-3 py-2 text-foreground-muted">
                  {c.license}
                  {isShareAlike(c.license) && (
                    <span className="ml-1 text-xs">
                      {az ? "· kəsilmiş variant da eyni lisenziya ilə" : "· crop under the same licence"}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-foreground-muted">
        {az ? "Cəmi " : "In total "}
        {credits.length}
        {az ? " şəkil." : " photographs."}{" "}
        <Link href="/players" className="hover:text-foreground hover:underline">
          {az ? "Oyunçular" : "Players"}
        </Link>
      </p>
    </PageShell>
  );
}
