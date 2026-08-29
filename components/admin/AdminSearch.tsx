import Link from "next/link";
import { inputClass, filterSelectClass, secondaryButtonClass } from "@/components/admin/formStyles";

export type AdminFilter = {
  /** URL parametrinin adı, məsələn `status` */
  name: string;
  /** Cari dəyər; boş olsa «hamısı» seçilir */
  value?: string;
  /** Boş dəyərin etiketi, məsələn «Bütün oyunlar» */
  allLabel: string;
  options: { value: string; label: string }[];
};

/**
 * Admin siyahıları üçün axtarış və filtrlər.
 *
 * Adi GET forması, JavaScript yoxdur. Səbəb: admin səhifələri server
 * komponentidir və axtarış üçün onları client-ə çevirmək bahalı dəyişiklikdir;
 * `<form method="get">` isə brauzerin öz işidir və heç nə tələb etmir.
 *
 * Filtrlər QƏSDƏN eyni formanın içindədir. Ayrı formada olsalar, filtri
 * dəyişmək axtarış sözünü silərdi (və əksinə) — brauzer yalnız göndərilən
 * formanın sahələrini ünvana yazır. Bir forma = hamısı birlikdə qalır.
 *
 * Digər parametrlər gizli sahələrlə saxlanılır. `page` QƏSDƏN saxlanılmır:
 * yeni axtarış və ya filtr həmişə birinci səhifədən başlamalıdır, yoxsa adam
 * 7-ci səhifədə boş nəticə görür.
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
