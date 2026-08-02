"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "@/i18n/navigation";
import ThemeToggle from "./ThemeToggle";
import LocaleSwitcher from "./LocaleSwitcher";

type AuthConfig = {
  label: string;
  loginHref: string;
  registerHref: string;
  loginLabel: string;
  registerLabel: string;
};

export default function MobileNav({
  navItems,
  localItem,
  teamAuth,
  playerAuth,
  fanAuth,
}: {
  navItems: { href: string; label: string }[];
  localItem: { href: string; label: string };
  teamAuth: AuthConfig;
  playerAuth: AuthConfig;
  fanAuth: AuthConfig;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Menu"
        className="flex h-9 w-9 items-center justify-center rounded-md border border-border-subtle bg-surface text-foreground-muted"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-[200] flex justify-end bg-black/60" onClick={() => setOpen(false)}>
            <div
              className="flex h-full w-72 max-w-[85vw] flex-col overflow-y-auto bg-surface p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ThemeToggle />
                  <LocaleSwitcher />
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="flex h-9 w-9 items-center justify-center rounded-md border border-border-subtle text-foreground-muted"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>

              <nav className="mb-4 flex flex-col gap-1">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="rounded-md px-3 py-2.5 text-sm font-medium text-foreground hover:bg-surface-raised"
                  >
                    {item.label}
                  </Link>
                ))}
                <Link
                  href={localItem.href}
                  onClick={() => setOpen(false)}
                  className="rounded-md px-3 py-2.5 text-sm font-medium text-brand-via hover:bg-surface-raised"
                >
                  🇦🇿 {localItem.label}
                </Link>
              </nav>

              {[teamAuth, playerAuth, fanAuth].map((auth) => (
                <div key={auth.label} className="mb-3 rounded-lg border border-border-subtle p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">{auth.label}</p>
                  <div className="flex gap-2">
                    <a
                      href={auth.loginHref}
                      className="flex-1 rounded-md border border-border-subtle px-3 py-2 text-center text-sm text-foreground hover:bg-surface-raised"
                    >
                      {auth.loginLabel}
                    </a>
                    <a
                      href={auth.registerHref}
                      className="brand-gradient-bg flex-1 rounded-md px-3 py-2 text-center text-sm font-semibold text-white"
                    >
                      {auth.registerLabel}
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
