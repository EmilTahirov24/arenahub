"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";

/**
 * Searches on submit rather than on every keystroke.
 *
 * Each search is a server round trip that re-reads and re-ranks the whole roster,
 * so firing one per character would put a request behind every letter of a
 * nickname. Enter (or the clear button) is the whole interaction.
 */
export default function PlayerSearch({
  game,
  defaultValue,
  placeholder,
  clearLabel,
}: {
  game?: string;
  defaultValue: string;
  placeholder: string;
  clearLabel: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);

  function go(next: string) {
    const query = new URLSearchParams();
    if (game) query.set("game", game);
    if (next.trim()) query.set("q", next.trim());
    // Sort and page are deliberately dropped: a new search starts at the top of
    // a different set of results, and page 4 of the old one means nothing here.
    const qs = query.toString();
    router.push(qs ? `/players?${qs}` : "/players");
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        go(value);
      }}
      className="mb-4 flex gap-2"
      role="search"
    >
      <input
        type="search"
        name="q"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full max-w-xs rounded-md border border-border-subtle bg-surface px-3 py-2 text-sm outline-none focus:border-brand-via"
      />
      {defaultValue && (
        <button
          type="button"
          onClick={() => {
            setValue("");
            go("");
          }}
          className="rounded-md border border-border-subtle px-3 py-2 text-sm text-foreground-muted hover:text-foreground"
        >
          {clearLabel}
        </button>
      )}
    </form>
  );
}
