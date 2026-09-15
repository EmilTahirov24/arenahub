import Link from "next/link";
import { inputClass, filterSelectClass, secondaryButtonClass } from "@/components/admin/formStyles";

export type AdminFilter = {
  /** Name of the URL parameter, `status` for instance. */
  name: string;
  /** The current value; empty selects "all". */
  value?: string;
  /** Label for the empty value, "All games" for instance. */
  allLabel: string;
  options: { value: string; label: string }[];
};

/**
 * Search and filters for the admin lists.
 *
 * A plain GET form, no JavaScript. The reason: the admin pages are server
 * components, and turning them into client components for the sake of a search
 * box is an expensive change, while `<form method="get">` is the browser's own
 * job and asks for nothing.
 *
 * The filters sit inside the same form DELIBERATELY. In a separate form,
 * changing a filter would wipe the search term (and the other way round) - the
 * browser writes only the submitted form's fields into the address. One form
 * means they all survive together.
 *
 * Other parameters are carried in hidden fields. `page` is deliberately NOT:
 * a new search or filter has to start from page one, or somebody lands on an
 * empty page 7.
 */
export default function AdminSearch({
  action,
  defaultValue,
  placeholder,
  keep = {},
  filters = [],
}: {
  action: string;
  defaultValue?: string;
  placeholder: string;
  keep?: Record<string, string | undefined>;
  filters?: AdminFilter[];
}) {
  const entries = Object.entries(keep).filter(([, v]) => v);
  const hasFilter = filters.some((f) => f.value);

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <form action={action} method="get" className="flex flex-1 flex-wrap items-center gap-2">
        {entries.map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <input
          name="q"
          type="search"
          defaultValue={defaultValue}
          placeholder={placeholder}
          aria-label={placeholder}
          className={`${inputClass} max-w-sm`}
        />
        {filters.map((filter) => (
          <select
            key={filter.name}
            name={filter.name}
            defaultValue={filter.value ?? ""}
            aria-label={filter.allLabel}
            className={filterSelectClass}
          >
            <option value="">{filter.allLabel}</option>
            {filter.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ))}
        <button type="submit" className={secondaryButtonClass}>
          {filters.length > 0 ? "Tətbiq et" : "Axtar"}
        </button>
      </form>
      {(defaultValue || hasFilter) && (
        <Link href={action} className={secondaryButtonClass}>
          Təmizlə
        </Link>
      )}
    </div>
  );
}
