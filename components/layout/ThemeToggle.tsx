"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    setTheme(current === "light" ? "light" : "dark");
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle theme"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-surface text-foreground-muted transition-colors hover:text-foreground"
    >
      {theme === "dark" ? (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
          <path d="M21.64 13a1 1 0 0 0-1.05-.14 8.05 8.05 0 0 1-3.37.73 8.15 8.15 0 0 1-8.14-8.1 8.59 8.59 0 0 1 .25-2A1 1 0 0 0 8 2.36a10.14 10.14 0 1 0 13.69 12.15 1 1 0 0 0-.05-1.51Z" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
          <path d="M12 4.5a1 1 0 0 1-1-1V2a1 1 0 0 1 2 0v1.5a1 1 0 0 1-1 1Zm0 15a1 1 0 0 1 1 1V22a1 1 0 0 1-2 0v-1.5a1 1 0 0 1 1-1ZM4.5 12a1 1 0 0 1-1 1H2a1 1 0 0 1 0-2h1.5a1 1 0 0 1 1 1Zm18 0a1 1 0 0 1-1 1H20a1 1 0 0 1 0-2h1.5a1 1 0 0 1 1 1ZM6.34 7.76a1 1 0 0 1-1.42 0L3.87 6.71A1 1 0 1 1 5.29 5.3l1.05 1.05a1 1 0 0 1 0 1.41Zm12.02 12.02a1 1 0 0 1-1.41 0l-1.05-1.05a1 1 0 1 1 1.41-1.41l1.05 1.05a1 1 0 0 1 0 1.41ZM6.34 16.24a1 1 0 0 1 0 1.41l-1.05 1.05a1 1 0 1 1-1.42-1.41l1.05-1.05a1 1 0 0 1 1.42 0Zm12.02-12.02a1 1 0 0 1 0 1.41l-1.05 1.05a1 1 0 1 1-1.41-1.41l1.05-1.05a1 1 0 0 1 1.41 0ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z" />
        </svg>
      )}
    </button>
  );
}
