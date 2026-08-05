import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import LocaleSwitcher from "./LocaleSwitcher";
import ThemeToggle from "./ThemeToggle";
import AuthMenu, { type AccountMenu } from "./AuthMenu";
import MobileNav from "./MobileNav";
import CommandPalette from "@/components/search/CommandPalette";
import PlayerAvatar from "@/components/common/PlayerAvatar";
import { getPlayerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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

  const playerAuth = {
    label: t("auth.player"),
    loginHref: "/player/login",
    registerHref: "/player/register",
    loginLabel: t("auth.login"),
    registerLabel: t("auth.register"),
  };

  // The header never looked at the session, so somebody who had just signed in
  // came back to the site and was offered "Login / Register" — the site had no
  // idea who they were, and there was no way back into their own dashboard.
  const session = await getPlayerSession();
  const player = session
    ? await prisma.player.findUnique({
        where: { id: session.id },
        select: { nickname: true, photoUrl: true },
      })
    : null;

  const account: AccountMenu | null = player
    ? {
        nickname: player.nickname,
        // Rendered here rather than inside the menu: PlayerAvatar falls back to
        // initials on its own, so a player with no photo still gets a face.
        avatar: <PlayerAvatar name={player.nickname} photoUrl={player.photoUrl} size={24} />,
        profileHref: "/player",
        profileLabel: t("auth.profile"),
        teamHref: "/player/team",
        teamLabel: t("auth.team"),
        logoutLabel: t("auth.logout"),
        logoutAction: logoutToSite,
      }
    : null;

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
          <CommandPalette />
          <AuthMenu icon={PlayerIcon} {...playerAuth} account={account} />
          <ThemeToggle />
          <LocaleSwitcher />
        </div>

        <div className="flex items-center gap-2 xl:hidden">
          <CommandPalette />
          <MobileNav
            navItems={NAV_ITEMS.map((item) => ({ href: `/${item}`, label: t(`nav.${item}`) }))}
            localItem={{ href: `/${LOCAL_NAV_ITEM}`, label: t(`nav.${LOCAL_NAV_ITEM}`) }}
            playerAuth={playerAuth}
            account={account}
          />
        </div>
      </div>
    </header>
  );
}
