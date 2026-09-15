"use client";

import { useEffect, useRef, useState } from "react";
import PlayerAvatar from "@/components/common/PlayerAvatar";
import { useAccount } from "./AccountContext";

/**
 * The fixed half of the account menu - labels, addresses and the sign-out
 * action.
 *
 * Who is signed in is no longer decided here: `useAccount()` fetches that on
 * the client, because the Header reading the session kept the whole site from
 * being cached. The nickname and avatar are not passed from the server for the
 * same reason.
 */
export type AccountMenu = {
  profileHref: string;
  profileLabel: string;
  teamHref: string;
  teamLabel: string;
  logoutLabel: string;
  logoutAction: () => void | Promise<void>;
};

export default function AuthMenu({
  label,
  icon,
  loginHref,
  registerHref,
  loginLabel,
  registerLabel,
  links,
}: {
  label: string;
  icon: React.ReactNode;
  loginHref: string;
  registerHref: string;
  loginLabel: string;
  registerLabel: string;
  links: AccountMenu;
}) {
  const { account, loading } = useAccount();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }

    // Clicking away closed the menu but Escape did not, which leaves anyone
    // navigating by keyboard with no way out of it.
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape" || !open) return;
      setOpen(false);
      // Focus goes back to the control that opened it, not to the top of the
      // page — otherwise the next Tab starts over from the beginning.
      buttonRef.current?.focus();
    }

    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const itemClass = "block w-full px-3 py-2 text-left text-sm text-foreground hover:bg-surface-raised";

  // Until the answer arrives, neither "Sign in" nor the nickname is shown.
  // Otherwise a signed-in person saw a flash of being signed out on every page
  // load.
  if (loading) {
    return (
      <div
        aria-hidden
        className="h-8 w-8 animate-pulse rounded-full border border-border-subtle bg-surface sm:w-24"
      />
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={account ? account.nickname : label}
        aria-expanded={open}
        aria-haspopup="menu"
        className={
          account
            ? "flex h-8 items-center gap-2 rounded-full border border-border-subtle bg-surface pl-1 pr-3 text-xs font-medium text-foreground transition-colors hover:bg-surface-raised"
            : "flex h-8 items-center gap-1.5 rounded-full border border-border-subtle bg-surface px-3 text-xs font-medium text-foreground-muted transition-colors hover:text-foreground"
        }
      >
        {account ? <PlayerAvatar name={account.nickname} photoUrl={account.photoUrl} size={24} /> : icon}
        <span className="hidden max-w-28 truncate sm:inline">
          {account ? account.nickname : label}
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-10 z-50 w-44 overflow-hidden rounded-lg border border-border-subtle bg-surface shadow-[var(--shadow-pop)]"
        >
          {account ? (
            <>
              <a href={links.profileHref} className={itemClass} role="menuitem">
                {links.profileLabel}
              </a>
              <a
                href={links.teamHref}
                className={`${itemClass} border-t border-border-subtle`}
                role="menuitem"
              >
                {links.teamLabel}
              </a>
              <form action={links.logoutAction} className="border-t border-border-subtle">
                <button type="submit" className={itemClass} role="menuitem">
                  {links.logoutLabel}
                </button>
              </form>
            </>
          ) : (
            <>
              <a href={loginHref} className={itemClass} role="menuitem">
                {loginLabel}
              </a>
              <a
                href={registerHref}
                className={`${itemClass} border-t border-border-subtle`}
                role="menuitem"
              >
                {registerLabel}
              </a>
            </>
          )}
        </div>
      )}
    </div>
  );
}
