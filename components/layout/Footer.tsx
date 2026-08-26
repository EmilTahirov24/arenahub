import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function Footer() {
  const t = await getTranslations();

  return (
    <footer className="border-t border-border-subtle bg-surface">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-8 text-sm text-foreground-muted">
        <div>
          <span className="font-display font-semibold brand-gradient-text">
            {t("site.name")}
          </span>
          <span> &copy; {new Date().getFullYear()} — {t("footer.rights")}</span>
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
