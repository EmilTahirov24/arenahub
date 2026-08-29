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
 * Çalar dairə üzrə seçilir, doyğunluq və işıqlılıq isə dar aralıqda saxlanılır.
 * Səbəb: avatarın üstündə ağ mətn var. Sərbəst buraxılsa, sarı fonda ağ hərflər
 * oxunmur — dar aralıq bütün çalarlarda kontrastı qoruyur.
 */
export function avatarColor(name: string, primaryColor?: string | null): string {
  if (primaryColor) return primaryColor;
  const hue = hash(name.trim().toLowerCase()) % 360;
  return `hsl(${hue} 58% 42%)`;
}
