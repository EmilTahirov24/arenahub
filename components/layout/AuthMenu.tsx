"use client";

import { useEffect, useRef, useState } from "react";

export default function AuthMenu({
  label,
  icon,
  loginHref,
  registerHref,
  loginLabel,
  registerLabel,
}: {
  label: string;
  icon: React.ReactNode;
  loginHref: string;
  registerHref: string;
  loginLabel: string;
  registerLabel: string;
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

  return (
    <div ref={ref} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={label}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-8 items-center gap-1.5 rounded-full border border-border-subtle bg-surface px-3 text-xs font-medium text-foreground-muted transition-colors hover:text-foreground"
      >
        {icon}
        <span className="hidden sm:inline">{label}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-40 overflow-hidden rounded-lg border border-border-subtle bg-surface shadow-xl">
          <a href={loginHref} className="block px-3 py-2 text-sm text-foreground hover:bg-surface-raised">
            {loginLabel}
          </a>
          <a href={registerHref} className="block border-t border-border-subtle px-3 py-2 text-sm text-foreground hover:bg-surface-raised">
            {registerLabel}
          </a>
        </div>
      )}
    </div>
  );
}
