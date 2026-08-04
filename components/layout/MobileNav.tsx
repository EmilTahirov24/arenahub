"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  playerAuth,
}: {
  navItems: { href: string; label: string }[];
  localItem: { href: string; label: string };
  playerAuth: AuthConfig;
}) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);

  // Closing always hands focus back to the button that opened the drawer.
  // Without this the focus ring lands back at the top of the document and the
  // next Tab restarts from the beginning of the page.
  const close = useCallback(() => {
    setOpen(false);
    openerRef.current?.focus();
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    // The drawer covers the page, but nothing stopped Tab from walking into the
    // links underneath it — so a keyboard or screen-reader user could be
    // "inside" a menu while operating things they cannot see. Focus starts in
    // the panel and cycles within it until the drawer is dismissed.
    panelRef.current?.querySelector<HTMLElement>("button, a")?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        close();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      // Only the two ends need handling; everything between them is the
      // browser's own tab order and is left alone.
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  return (
    <div className="xl:hidden">
      <button
        ref={openerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Menu"
        aria-expanded={open}
        aria-haspopup="dialog"
        className="flex h-9 w-9 items-center justify-center rounded-md border border-border-subtle bg-surface text-foreground-muted"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-[200] flex justify-end bg-black/60" onClick={close}>
            <div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-label={playerAuth.label}
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
                  onClick={close}
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

              <div className="mb-3 rounded-lg border border-border-subtle p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">{playerAuth.label}</p>
                <div className="flex gap-2">
                  <a
                    href={playerAuth.loginHref}
                    className="flex-1 rounded-md border border-border-subtle px-3 py-2 text-center text-sm text-foreground hover:bg-surface-raised"
                  >
                    {playerAuth.loginLabel}
                  </a>
                  <a
                    href={playerAuth.registerHref}
                    className="brand-gradient-bg flex-1 rounded-md px-3 py-2 text-center text-sm font-semibold text-white"
                  >
                    {playerAuth.registerLabel}
                  </a>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
