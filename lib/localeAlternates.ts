import { siteUrl } from "@/lib/siteUrl";
import { routing } from "@/i18n/routing";

/**
 * Bir səhifənin kanonik ünvanı və dil qarşılıqları.
 *
 * İki ayrı problemi birlikdə həll edir.
 *
 * KANONİK. Saytda heç bir canonical etiketi yox idi. Siyahı səhifələri isə
 * sorğu parametrləri ilə işləyir — `?game=cs2`, `?page=3`, `?sort=kills` — və
 * hər kombinasiya axtarış sistemi üçün ayrıca ünvandır. Yəni eyni məzmun
 * onlarla nüsxədə indekslənə bilər.
 *
 * Burada kanonik həmişə parametrsiz yola işarə edir. Səhifələnmiş siyahılarda
 * bu, ümumiyyətlə ehtiyatla yanaşılan bir seçimdir: adətən 2-ci səhifədəki
 * məzmun başqa yerdə mövcud olmur və kanonik onu birinciyə göndərəndə itir.
 * BİZDƏ bu risk yoxdur, çünki hər matç, komanda, oyunçu və xəbərin öz ünvanı
 * var və hamısı sitemap-dədir — siyahının ikinci səhifəsi unikal heç nə
 * daşımır. Ona görə filtr və səhifə variantlarını bir ünvanda toplamaq düzgün
 * seçimdir.
 *
 * DİL QARŞILIQLARI. Sayt eyni məzmunu iki dildə verir. hreflang olmadan axtarış
 * sistemi `/az/...` və `/en/...` cütünü təkrar məzmun kimi görə və birini
 * kənarlaşdıra bilər. Bu etiketlər onların eyni səhifənin iki dili olduğunu
 * bildirir.
 *
 * `x-default` azərbaycancaya gedir: saytın əsas auditoriyası budur, ingilis
 * variant ikinci dildir.
 *
 * Diqqət: buraya sorğu parametrləri ÖTÜRÜLMÜR və bu qəsdəndir. Onları oxumaq
 * üçün `generateMetadata`-da `searchParams`-ı gözləmək lazım gələrdi, bu isə
 * səhifənin statik qabığını dinamikə çevirib keşləmə işinin qazancını geri
 * qaytarardı.
 */
export function localeAlternates(locale: string, path = "") {
  const base = siteUrl();
  const clean = path === "/" ? "" : path;

  const languages: Record<string, string> = {};
  for (const l of routing.locales) {
    languages[l] = `${base}/${l}${clean}`;
  }
  languages["x-default"] = `${base}/${routing.defaultLocale}${clean}`;

  return {
    canonical: `${base}/${locale}${clean}`,
    languages,
  };
}
