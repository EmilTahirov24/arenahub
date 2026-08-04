import { Link } from "@/i18n/navigation";

/**
 * A column heading that is also the control for sorting by that column.
 *
 * A link rather than a button: sorting is a different view of the same page, so
 * it belongs in the URL — shareable, bookmarkable, survives a reload, and works
 * before any JavaScript has loaded.
 */
export default function SortableHeader({
  label,
  sortKey,
  activeKey,
  activeDir,
  nextDir,
  query,
  pathname,
  align = "left",
  className = "",
}: {
  label: string;
  sortKey: string;
  activeKey: string;
  activeDir: "asc" | "desc";
  /** Direction this column should take when clicked from its current state. */
  nextDir: "asc" | "desc";
  query: Record<string, string>;
  pathname: string;
  align?: "left" | "right" | "center";
  className?: string;
}) {
  const isActive = activeKey === sortKey;
  const justify = align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start";

  return (
    <th className={className} aria-sort={isActive ? (activeDir === "asc" ? "ascending" : "descending") : "none"}>
      <Link
        href={{ pathname, query: { ...query, sort: sortKey, dir: nextDir } }}
        className={`flex items-center gap-1 ${justify} hover:text-foreground ${isActive ? "text-foreground" : ""}`}
      >
        {label}
        {/* The inactive marker is kept in the layout but invisible, so headings
            do not shift sideways as the sorted column changes. */}
        <span aria-hidden className={isActive ? "" : "opacity-0"}>
          {isActive && activeDir === "asc" ? "▲" : "▼"}
        </span>
      </Link>
    </th>
  );
}
