"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The signed-in half of the menu.
 *
 * `avatar` arrives already rendered from the server so this component never
 * needs the player record itself — see components/layout/Header.tsx.
 */
export type AccountMenu = {
  nickname: string;
  avatar: React.ReactNode;
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
  account,
}: {
  label: string;
  icon: React.ReactNode;
  loginHref: string;
  registerHref: string;
  loginLabel: string;
  registerLabel: string;
  /** Null when nobody is signed in — then the menu offers login and register. */
  account?: AccountMenu | null;
}) {
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
        {account ? account.avatar : icon}
        <span className="hidden max-w-28 truncate sm:inline">
          {account ? account.nickname : label}
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-10 z-50 w-44 overflow-hidden rounded-lg border border-border-subtle bg-surface shadow-xl"
        >
          {account ? (
            <>
              <a href={account.profileHref} className={itemClass} role="menuitem">
                {account.profileLabel}
              </a>
              <a
                href={account.teamHref}
                className={`${itemClass} border-t border-border-subtle`}
                role="menuitem"
              >
                {account.teamLabel}
              </a>
              <form action={account.logoutAction} className="border-t border-border-subtle">
                <button type="submit" className={itemClass} role="menuitem">
                  {account.logoutLabel}
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
