import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import LocaleSwitcher from "./LocaleSwitcher";
import ThemeToggle from "./ThemeToggle";
import AuthMenu from "./AuthMenu";
import MobileNav from "./MobileNav";
import CommandPalette from "@/components/search/CommandPalette";

const TeamIcon = (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
    <circle cx="10" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M17 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const PlayerIcon = (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="8" width="20" height="9" rx="4" />
    <path d="M7 12.5h3M8.5 11v3" />
    <circle cx="16" cy="11.5" r="0.9" fill="currentColor" />
    <circle cx="18.2" cy="13.5" r="0.9" fill="currentColor" />
  </svg>
);

const FanIcon = (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
    <circle cx="12" cy="12" r="3" />
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

  const teamAuth = {
    label: t("auth.team"),
    loginHref: "/team/login",
    registerHref: "/team/register",
    loginLabel: t("auth.login"),
    registerLabel: t("auth.register"),
  };
  const playerAuth = {
    label: t("auth.player"),
    loginHref: "/player/login",
    registerHref: "/player/register",
    loginLabel: t("auth.login"),
    registerLabel: t("auth.register"),
  };
  const fanAuth = {
    label: t("auth.fan"),
    loginHref: "/fan/login",
    registerHref: "/fan/register",
    loginLabel: t("auth.login"),
    registerLabel: t("auth.register"),
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border-subtle bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="font-display text-xl font-bold tracking-tight">
          <span className="brand-gradient-text">{t("site.name")}</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
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

        <div className="hidden items-center gap-2 md:flex">
          <CommandPalette />
          <AuthMenu icon={TeamIcon} {...teamAuth} />
          <AuthMenu icon={PlayerIcon} {...playerAuth} />
          <AuthMenu icon={FanIcon} {...fanAuth} />
          <ThemeToggle />
          <LocaleSwitcher />
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <CommandPalette />
          <MobileNav
            navItems={NAV_ITEMS.map((item) => ({ href: `/${item}`, label: t(`nav.${item}`) }))}
            localItem={{ href: `/${LOCAL_NAV_ITEM}`, label: t(`nav.${LOCAL_NAV_ITEM}`) }}
            teamAuth={teamAuth}
            playerAuth={playerAuth}
            fanAuth={fanAuth}
          />
        </div>
      </div>
    </header>
  );
}
