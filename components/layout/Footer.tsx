import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import AdSlot from "@/components/ads/AdSlot";

export default async function Footer() {
  const t = await getTranslations();

  return (
    <footer className="border-t border-border-subtle bg-surface">
      <div className="mx-auto flex max-w-[1400px] justify-center px-4 pt-6">
        <AdSlot placement="FOOTER" />
      </div>
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-8 text-sm text-foreground-muted">
        <div>
          <span className="font-display font-semibold brand-gradient-text">
            {t("site.name")}
          </span>
          <span> &copy; {new Date().getFullYear()} — {t("footer.rights")}</span>
        </div>
        <div className="flex gap-4 text-xs">
          <Link href="/terms" className="hover:text-foreground hover:underline">
            İstifadə Şərtləri
          </Link>
          <Link href="/privacy" className="hover:text-foreground hover:underline">
            Məxfilik Siyasəti
          </Link>
        </div>
      </div>
    </footer>
  );
}
