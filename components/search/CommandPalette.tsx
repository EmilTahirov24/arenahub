"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { SearchResult } from "@/app/api/search/route";

const TYPE_LABEL: Record<SearchResult["type"], { az: string; en: string }> = {
  team: { az: "Komanda", en: "Team" },
  player: { az: "Oyunçu", en: "Player" },
  tournament: { az: "Turnir", en: "Tournament" },
  news: { az: "Xəbər", en: "News" },
};

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const locale = useLocale();
  const router = useRouter();

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResults([]);
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    if (query.trim().length < 2) return;
    const id = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&locale=${locale}`);
        const data = await res.json();
        setResults(data.results ?? []);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(id);
  }, [query, locale]);

  function go(href: string) {
    close();
    router.push(href.replace(/^\/(az|en)/, ""));
  }

  // Results are only meaningful for the query they were fetched for; while the
  // user shortens the input below the threshold, don't show the stale list.
  const visibleResults = query.trim().length < 2 ? [] : results;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search"
        className="flex h-8 items-center gap-2 rounded-full border border-border-subtle bg-surface px-3 text-foreground-muted transition-colors hover:text-foreground"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.35-4.35" strokeLinecap="round" />
        </svg>
        <span className="hidden text-xs sm:inline">⌘K</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 px-4 pt-24" onClick={close}>
          <div
            className="w-full max-w-lg overflow-hidden rounded-xl border border-border-subtle bg-surface shadow-[var(--shadow-pop)]"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={locale === "az" ? "Komanda, oyunçu, turnir, xəbər axtar..." : "Search teams, players, events, news..."}
              className="w-full border-b border-border-subtle bg-transparent px-4 py-3 text-sm outline-none"
            />
            <div className="max-h-80 overflow-y-auto">
              {loading && <p className="px-4 py-3 text-sm text-foreground-muted">...</p>}
              {!loading && query.trim().length >= 2 && visibleResults.length === 0 && (
                <p className="px-4 py-3 text-sm text-foreground-muted">
                  {locale === "az" ? "Nəticə tapılmadı." : "No results."}
                </p>
              )}
              {visibleResults.map((r, i) => (
                <button
                  key={`${r.type}-${i}`}
                  onClick={() => go(r.href)}
                  className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm hover:bg-surface-raised"
                >
                  <span className="truncate">{r.label}</span>
                  <span className="shrink-0 text-xs text-foreground-muted">
                    {TYPE_LABEL[r.type][locale === "en" ? "en" : "az"]} · {r.sublabel}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
