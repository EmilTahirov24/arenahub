"use client";

import { useLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { usePathname, useRouter } from "@/i18n/navigation";

export default function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="flex items-center gap-1 rounded-full border border-border-subtle bg-surface p-1 text-xs font-medium">
      {routing.locales.map((loc) => (
        <button
          key={loc}
          onClick={() => router.replace(pathname, { locale: loc })}
          className={`rounded-full px-2.5 py-1 uppercase transition-colors ${
            loc === locale
              ? "brand-gradient-bg text-white"
              : "text-foreground-muted hover:text-foreground"
          }`}
        >
          {loc}
        </button>
      ))}
    </div>
  );
}
