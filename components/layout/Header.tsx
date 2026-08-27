import { Suspense } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import LocaleSwitcher from "./LocaleSwitcher";
import ThemeToggle from "./ThemeToggle";
import AuthMenu, { type AccountMenu } from "./AuthMenu";
import MobileNav from "./MobileNav";
import CommandPalette from "@/components/search/CommandPalette";
import { logoutToSite } from "@/app/[locale]/actions";

const PlayerIcon = (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="8" width="20" height="9" rx="4" />
    <path d="M7 12.5h3M8.5 11v3" />
    <circle cx="16" cy="11.5" r="0.9" fill="currentColor" />
    <circle cx="18.2" cy="13.5" r="0.9" fill="currentColor" />
  </svg>
);

const NAV_ITEMS = [
  "matches",
  "results",
  "live",
  "teams",
  "players",
  "news",
  "events",
  "stats",
] as const;

const LOCAL_NAV_ITEM = "local";

export default async function Header() {
  const t = await getTranslations();
  const locale = await getLocale();

  // /player [locale] seqmentindən kənardadır, yəni dil ünvandan gəlmir. Onu
  // linkdə ötürürük ki, ingilis saytdan gələn adam ingilis forma görsün —
  // xüsusilə şərtlər qutusunun linkləri onun oxuya bildiyi dilə getsin.
  // Azərbaycanca default olduğu üçün ona parametr əlavə edilmir.
  const langQuery = locale === "az" ? "" : `?lang=${locale}`;

  const playerAuth = {
    label: t("auth.player"),
    loginHref: `/player/login${langQuery}`,
    registerHref: `/player/register${langQuery}`,
    loginLabel: t("auth.login"),
    registerLabel: t("auth.register"),
  };

  // Kimin girdiyi burada oxunmur — bax components/layout/AccountContext.tsx.
  // Sessiyanı serverdə oxumaq `cookies()` demək idi, o isə marşrutu dinamik edir;
  // Header hər səhifədə olduğu üçün bütün public sayt keşlənə bilməz qalırdı.
  // Burada yalnız dəyişməyən hissə qurulur: etiketlər, ünvanlar və çıxış əməliyyatı.
  const accountLinks: AccountMenu = {
    profileHref: "/player",
    profileLabel: t("auth.profile"),
    teamHref: "/player/team",
    teamLabel: t("auth.team"),
    logoutLabel: t("auth.logout"),
    logoutAction: logoutToSite,
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border-subtle bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="font-display text-xl font-bold tracking-tight">
          <span className="brand-gradient-text">{t("site.name")}</span>
        </Link>

        <nav className="hidden items-center gap-1 xl:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item}
              href={`/${item}`}
              className="rounded-md px-3 py-2 text-sm font-medium text-foreground-muted transition-colors hover:bg-surface hover:text-foreground"
            >
              {t(`nav.${item}`)}
            </Link>
          ))}
          <Link
            href={`/${LOCAL_NAV_ITEM}`}
            className="ml-1 rounded-md border border-brand-via/30 bg-brand-via/10 px-3 py-2 text-sm font-medium text-brand-via transition-colors hover:bg-brand-via/20"
          >
            🇦🇿 {t(`nav.${LOCAL_NAV_ITEM}`)}
          </Link>
        </nav>

        <div className="hidden items-center gap-2 xl:flex">
          {/* CommandPalette `useRouter()` işlədir, o isə cari ünvanı oxuyur —
              sorğu vaxtı məlum olan məlumatdır və öz sərhəddi olmasa bütün
              səhifənin prerender olunmasına mane olur. */}
          <Suspense fallback={<div aria-hidden className="h-8 w-8 rounded-full border border-border-subtle bg-surface sm:w-20" />}>
            <CommandPalette />
          </Suspense>
          <AuthMenu icon={PlayerIcon} {...playerAuth} links={accountLinks} />
          <ThemeToggle />
          {/* LocaleSwitcher cari ünvanı oxuyur (usePathname) ki, dil dəyişəndə
              eyni səhifədə qalsın. Bu, sorğu vaxtı məlum olan məlumatdır, ona
              görə öz sərhəddi olmalıdır — əks halda bütün səhifə prerender
              oluna bilmir. Yer tutucu düymənin ölçüsündədir ki, header
              sıçramasın. */}
          <Suspense fallback={<div aria-hidden className="h-8 w-16 rounded-md bg-surface" />}>
            <LocaleSwitcher />
          </Suspense>
        </div>

        <div className="flex items-center gap-2 xl:hidden">
          {/* CommandPalette `useRouter()` işlədir, o isə cari ünvanı oxuyur —
              sorğu vaxtı məlum olan məlumatdır və öz sərhəddi olmasa bütün
              səhifənin prerender olunmasına mane olur. */}
          <Suspense fallback={<div aria-hidden className="h-8 w-8 rounded-full border border-border-subtle bg-surface sm:w-20" />}>
            <CommandPalette />
          </Suspense>
          <MobileNav
            navItems={NAV_ITEMS.map((item) => ({ href: `/${item}`, label: t(`nav.${item}`) }))}
            localItem={{ href: `/${LOCAL_NAV_ITEM}`, label: t(`nav.${LOCAL_NAV_ITEM}`) }}
            playerAuth={playerAuth}
            links={accountLinks}
          />
        </div>
      </div>
    </header>
  );
}
