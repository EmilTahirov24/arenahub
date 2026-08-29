/**
 * Loqosu olmayan komanda üçün sabit rəng.
 *
 * `TeamAvatar` fon kimi `primaryColor ?? "#7c3aed"` işlədirdi. Nəticə canlı
 * saytda ölçüldü (2026-08-30, /az/teams?game=dota2): səhifədə 102 loqosuz
 * avatar vardı və hamısının rəngi EYNİ idi — `#7c3aed`. Bir ekranda yüz eyni
 * bənövşəyi kvadrat loqo əvəzi kimi yox, yüklənməmiş şəkil kimi oxunur.
 *
 * Rəng addan alınır, təsadüfi deyil: eyni komanda hər səhifədə, hər
 * yeniləmədə eyni rəngi alır. Serverdə və brauzerdə eyni nəticə verir, ona görə
 * hidratasiya uyğunsuzluğu yaratmır.
 *
 * Bu, uydurma məlumat DEYİL: rəng heç nə iddia etmir, sadəcə sətirləri
 * bir-birindən ayırır. Komandanın öz rəngi bilinirsə (`primaryColor`), həmişə
 * o üstündür.
 */

/** FNV-1a: qısa, sürətli və dəyişməz — eyni ad həmişə eyni ədəd verir. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Çalar dairə üzrə seçilir, doyğunluq və işıqlılıq isə sabit qalır.
 *
 * İşıqlılıq 28%-dir və bu rəqəm seçilməyib, HESABLANIB. Avatarın üstündə ağ
 * mətn var; ilk versiyada 42% yazmışdım və 360 çaların hamısını yoxlayanda
 * ən pis hal — sarı, h=60, #a9a92d — ağ mətnlə cəmi 2.50:1 verirdi, yəni
 * WCAG həddinin yarısı. axe bunu tutmurdu, çünki fon qradiyentdir və alət
 * qradiyentli elementləri atlayır: rəqəm yalnız əl ilə ölçəndə üzə çıxdı.
 *
 * Ölçülən hədlər (S=58%): 34% -> 3.71, 32% -> 4.12, 30% -> 4.60, 28% -> 5.14.
 * 30% keçir, amma sərhədə çox yaxındır; 28% ehtiyat saxlayır.
 */
export function avatarColor(name: string, primaryColor?: string | null): string {
  if (primaryColor) return primaryColor;
  const hue = hash(name.trim().toLowerCase()) % 360;
  return `hsl(${hue} 58% 28%)`;
}
