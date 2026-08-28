import Link from "next/link";
import { inputClass, secondaryButtonClass } from "@/components/admin/formStyles";

/**
 * Admin siyahıları üçün axtarış.
 *
 * Adi GET forması, JavaScript yoxdur. Səbəb: admin səhifələri server
 * komponentidir və axtarış üçün onları client-ə çevirmək bahalı dəyişiklikdir;
 * `<form method="get">` isə brauzerin öz işidir və heç nə tələb etmir.
 *
 * Digər parametrlər gizli sahələrlə saxlanılır — axtarış oyun filtrini, filtr
 * isə axtarışı səssizcə silməməlidir. `page` QƏSDƏN saxlanılmır: yeni axtarış
 * həmişə birinci səhifədən başlamalıdır, yoxsa adam 7-ci səhifədə boş nəticə
 * görür.
 */
export default function AdminSearch({
  action,
  defaultValue,
  placeholder,
  keep = {},
}: {
  action: string;
  defaultValue?: string;
  placeholder: string;
  keep?: Record<string, string | undefined>;
}) {
  const entries = Object.entries(keep).filter(([, v]) => v);

  return (
    <div className="mb-4 flex items-center gap-2">
      <form action={action} method="get" className="flex flex-1 items-center gap-2">
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
        <button type="submit" className={secondaryButtonClass}>
          Axtar
        </button>
      </form>
      {defaultValue && (
        <Link href={action} className={secondaryButtonClass}>
          Təmizlə
        </Link>
      )}
    </div>
  );
}
