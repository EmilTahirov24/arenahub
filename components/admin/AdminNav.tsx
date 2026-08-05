"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type AdminNavItem = {
  href: string;
  label: string;
  /** Rendered as a count pill; omitted or zero shows nothing. */
  badge?: number;
};

/**
 * The admin sections, collapsed behind a button on a phone.
 *
 * The sidebar becomes a strip across the top on narrow screens, and ten links
 * stacked in it pushed the page a full screen down — you arrived at a table and
 * saw only the menu that got you there. Above `sm` nothing changes: the list is
 * always open and the toggle does not exist.
 *
 * The count of anything waiting stays visible while collapsed, otherwise
 * hiding the menu would also hide the one thing asking for attention.
 */
export default function AdminNav({ items }: { items: AdminNavItem[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const waiting = items.reduce((n, i) => n + (i.badge ?? 0), 0);
  // Longest match, so /admin/games wins over /admin rather than both lighting up.
  const current = items
    .filter((i) => pathname === i.href || pathname.startsWith(i.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="admin-nav"
        className="mb-2 flex w-full items-center justify-between rounded-md border border-border-subtle px-3 py-2 text-sm text-foreground transition-colors hover:bg-surface-raised sm:hidden"
      >
        <span className="flex items-center gap-2">
          {/* Where you are, so the collapsed button is a label and not just a lid. */}
          {current?.label ?? "Bölmələr"}
          {waiting > 0 && (
            <span className="brand-gradient-bg rounded-full px-1.5 text-[10px] font-bold text-white">
              {waiting}
            </span>
          )}
        </span>
        <svg
          viewBox="0 0 24 24"
          className={`h-4 w-4 shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      <nav id="admin-nav" className={`space-y-1 ${open ? "block" : "hidden"} sm:block`}>
        {items.map((item) => {
          const active = item.href === current?.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              // Closing on the way out puts the content back on screen; the
              // layout is not remounted between admin pages, so the panel would
              // otherwise stay open over the page you just asked for.
              onClick={() => setOpen(false)}
              aria-current={active ? "page" : undefined}
              className={`flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors hover:bg-surface-raised hover:text-foreground ${
                active ? "bg-surface-raised text-foreground" : "text-foreground-muted"
              }`}
            >
              {item.label}
              {item.badge ? (
                <span className="brand-gradient-bg rounded-full px-1.5 text-[10px] font-bold text-white">
                  {item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
