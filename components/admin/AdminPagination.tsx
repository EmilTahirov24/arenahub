import Link from "next/link";

/**
 * Admin siyahıları üçün səhifələmə.
 *
 * Public tərəfdəki `components/common/Pagination.tsx` burada işlədilə bilmir:
 * o, `@/i18n/navigation`-ın Link-ini işlədir və hər ünvana dil prefiksi qoşur,
 * admin isə `[locale]`-dən kənardadır. Ona görə eyni davranış, adi next/link ilə.
 *
 * Uzun siyahılar qısaldılır: birinci, sonuncu və cari səhifənin ətrafı.
 */
export default function AdminPagination({
  page,
  totalPages,
  total,
  pathname,
  query = {},
}: {
  page: number;
  totalPages: number;
  total: number;
  pathname: string;
  query?: Record<string, string | undefined>;
}) {
  if (totalPages <= 1) return null;

  const href = (p: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v) params.set(k, v);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  const box = "rounded-md border px-3 py-1.5 text-sm transition-colors";
  const idle = "border-border-subtle text-foreground-muted hover:text-foreground";
  const active = "border-brand-via text-foreground";

  const shown = new Set<number>([1, totalPages, page - 1, page, page + 1]);
  const pages = [...shown].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);

  return (
    <nav className="mt-4 flex flex-wrap items-center gap-2" aria-label="Səhifələr">
      {page > 1 && (
        <Link href={href(page - 1)} className={`${box} ${idle}`} rel="prev">
          ← Əvvəlki
        </Link>
      )}
      {pages.map((p, i) => (
        <span key={p} className="flex items-center gap-2">
          {i > 0 && pages[i - 1] !== p - 1 && <span className="text-foreground-muted">…</span>}
          <Link href={href(p)} className={`${box} ${p === page ? active : idle}`}>
            {p}
          </Link>
        </span>
      ))}
      {page < totalPages && (
        <Link href={href(page + 1)} className={`${box} ${idle}`} rel="next">
          Növbəti →
        </Link>
      )}
      <span className="ml-auto text-xs text-foreground-muted">cəmi {total}</span>
    </nav>
  );
}
