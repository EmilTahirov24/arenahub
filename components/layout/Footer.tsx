import { getTranslations } from "next-intl/server";
import { cacheLife } from "next/cache";
import { Link } from "@/i18n/navigation";

/**
 * Müəllif hüququ ili.
 *
 * Footer hər səhifədədir, ona görə onun içindəki hər şey bütün saytın prerender
 * oluna bilməsinə təsir edir. `new Date()` render-dən render-ə dəyişə bilən
 * dəyərdir və statik qabığa qoyula bilməz — qabıq nə vaxt yaradıldığından asılı
 * olardı.
 *
 * Yalnız il keşlənir, bütöv Footer yox: Footer `getTranslations()` çağırır, o isə
 * daxilən `headers()` oxuyur və keş sahəsində dinamik mənbəyə icazə verilmir.
 * İl ildə bir dəfə dəyişir.
 */
async function copyrightYear() {
  "use cache";
  cacheLife("days");
  return new Date().getFullYear();
}

export default async function Footer() {
  const t = await getTranslations();
  const year = await copyrightYear();

  return (
    <footer className="border-t border-border-subtle bg-surface">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-8 text-sm text-foreground-muted">
        <div>
          <span className="font-display font-semibold brand-gradient-text">
            {t("site.name")}
          </span>
          <span> &copy; {year} — {t("footer.rights")}</span>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs">
          {/* CC-BY-SA requires crediting Liquipedia wherever their data is used;
              this is a licence condition, not a courtesy. */}
          <span>
            {t("footer.rosterSource")}{" "}
            <a
              href="https://liquipedia.net"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground hover:underline"
            >
              Liquipedia
            </a>{" "}
            <a
              href="https://creativecommons.org/licenses/by-sa/3.0/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground hover:underline"
            >
              (CC BY-SA 3.0)
            </a>
          </span>
          {/* Oyunçu şəkilləri CC BY / CC BY-SA-dır və müəllifin adı lisenziyanın
              şərtidir. 40 pikselik avatarın yanında ad yazmaq mümkün deyil, ona
              görə tam siyahı ayrıca səhifədədir. */}
          <Link href="/credits" className="hover:text-foreground hover:underline">
            {t("footer.credits")}
          </Link>
          <Link href="/terms" className="hover:text-foreground hover:underline">
            {t("footer.terms")}
          </Link>
          <Link href="/privacy" className="hover:text-foreground hover:underline">
            {t("footer.privacy")}
          </Link>
        </div>
      </div>
    </footer>
  );
}
