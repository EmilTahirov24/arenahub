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

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={label}
        className="flex h-8 items-center gap-1.5 rounded-full border border-border-subtle bg-surface px-3 text-xs font-medium text-foreground-muted transition-colors hover:text-foreground"
      >
        {icon}
        <span className="hidden 2xl:inline">{label}</span>
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
