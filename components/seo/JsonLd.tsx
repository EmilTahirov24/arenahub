/**
 * Səhifənin strukturlaşdırılmış təsviri (schema.org / JSON-LD).
 *
 * Saytda 2000-dən çox matç, 800-dən çox komanda və 600 oyunçu var, amma bunların
 * heç biri maşın üçün oxunaqlı deyildi: axtarış sistemi səhifədə yalnız mətn
 * görürdü, "bu, filan tarixdə keçən idman qarşılaşmasıdır" məlumatını yox.
 *
 * TƏHLÜKƏSİZLİK. Adlar bizim yazdığımız mətn deyil — Liquipedia-dan idxal
 * olunur. `JSON.stringify` HTML-i qaçırmır, yəni ad içindəki `</script>` bu
 * etiketi vaxtından əvvəl bağlayıb səhifəyə kod yeridə bilər. `<` simvolunun
 * unicode qarşılığı ilə əvəzlənməsi bunun qarşısını alır; Next-in öz sənədi də
 * məhz bunu tövsiyə edir.
 *
 * QAYDA: yalnız HƏQİQƏTƏN bildiyimiz sahələr yazılır. Boş və ya naməlum dəyər
 * ötürülmür — schema.org-a uydurma məlumat vermək saytda uydurma rəqəm
 * göstərməkdən fərqli deyil.
 */
export default function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

/** Boş, null və undefined sahələri atır — schema-ya yarımçıq dəyər getməsin. */
export function compact<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined || v === "") continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out;
}
