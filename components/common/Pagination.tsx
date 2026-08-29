import { Link } from "@/i18n/navigation";

/**
 * Page links for a server-rendered table.
 *
 * Long runs are elided rather than printed in full: 230 players is five pages,
 * but the same table filtered differently could be twenty, and a wall of
 * numbers is harder to use than a short one.
 */
export default function Pagination({
  page,
  totalPages,
  pathname,
  query,
  labels,
}: {
  page: number;
  totalPages: number;
  pathname: string;
  query: Record<string, string>;
  labels: { previous: string; next: string; summary: string };
}) {
  if (totalPages <= 1) return null;

  const href = (p: number) => ({ pathname, query: p === 1 ? query : { ...query, page: String(p) } });
  const box = "rounded-md border px-3 py-1.5 text-sm transition-colors";
  const idle = "border-border-subtle text-foreground-muted hover:text-foreground";
  // `/40` bu mətni 1.79:1-ə salırdı — WCAG həddinin dörddə biri. Deaktiv
// görünüş haşiyə və kursor ilə verilir; mətnin özü oxunaqlı qalır.
const dead = "border-border-subtle/50 text-foreground-muted cursor-default";

  // First, last, and a window around the current page.
  const shown = new Set<number>([1, totalPages, page - 1, page, page + 1]);
  const pages = [...shown].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);

  return (
    <nav className="mt-4 flex flex-wrap items-center gap-2" aria-label={labels.summary}>
      {page > 1 ? (
        <Link href={href(page - 1)} className={`${box} ${idle}`} rel="prev">
          ← {labels.previous}
        </Link>
      ) : (
        <span className={`${box} ${dead}`}>← {labels.previous}</span>
      )}

      {pages.map((p, i) => (
        <span key={p} className="flex items-center gap-2">
          {i > 0 && pages[i - 1] !== p - 1 && <span className="text-sm text-foreground-muted">…</span>}
          {p === page ? (
            <span className={`${box} border-brand-via bg-brand-via/10 font-semibold`} aria-current="page">
              {p}
            </span>
          ) : (
            <Link href={href(p)} className={`${box} ${idle}`}>
              {p}
            </Link>
          )}
        </span>
      ))}

      {page < totalPages ? (
        <Link href={href(page + 1)} className={`${box} ${idle}`} rel="next">
          {labels.next} →
        </Link>
      ) : (
        <span className={`${box} ${dead}`}>{labels.next} →</span>
      )}

      <span className="ml-auto text-sm text-foreground-muted">{labels.summary}</span>
    </nav>
  );
}
