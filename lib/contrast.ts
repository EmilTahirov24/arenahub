/**
 * Mətn rənglərini oxunaqlı hala gətirir.
 *
 * Niyə lazımdır: `Game.accentColor` admin panelindən gəlir, yəni ixtiyari
 * rəngdir. `GameChip` onu həm mətn, həm də öz solğun fonu kimi işlədirdi və
 * nəticə ölçüldü (axe-core, 2026-08-30, canlı sayt):
 *
 *   qaranlıq tema:  Dota 2 #dc2626 -> 3.39:1   (lazım 4.5)
 *   işıqlı tema:    CS2 #f5a524 -> 1.90:1, LoL #c9aa71 -> 2.07:1,
 *                   VALORANT #ff4655 -> 2.97:1, Dota 2 -> 4.13:1
 *
 * Yəni işıqlı temada DÖRD oyunun hamısı sınırdı. axe standart olaraq yalnız
 * qaranlıq temanı skan etdiyi üçün bu, hesabatda görünmürdü.
 *
 * Ayrı-ayrı rəngləri əl ilə düzəltmək həll deyil: admin sabah beşinci oyunu
 * istənilən rənglə əlavə edə bilər. Ona görə düzəliş hesablanır.
 */

type RGB = [number, number, number];

function parseHex(hex: string): RGB | null {
  const h = hex.trim().replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as RGB;
}

function toHex(rgb: RGB): string {
  return "#" + rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("");
}

/** sRGB kanalını xətti işıqlılığa çevirir (WCAG 2.x düsturu). */
function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function luminance(rgb: RGB): number {
  return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
}

/** İki rəng arasındakı WCAG kontrast nisbəti: 1 (eyni) — 21 (qara/ağ). */
export function contrastRatio(a: string, b: string): number {
  const ra = parseHex(a);
  const rb = parseHex(b);
  if (!ra || !rb) return 1;
  const la = luminance(ra);
  const lb = luminance(rb);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function mix(from: RGB, to: RGB, t: number): RGB {
  return from.map((c, i) => c + (to[i] - c) * t) as RGB;
}

/** Yarımşəffaf rəngi fonun üstünə yerləşdirib alınan bərk rəngi qaytarır. */
export function composite(fg: string, alpha: number, bg: string): string {
  const f = parseHex(fg);
  const b = parseHex(bg);
  if (!f || !b) return bg;
  return toHex(f.map((c, i) => c * alpha + b[i] * (1 - alpha)) as RGB);
}

/**
 * `color`-u `background` üzərində ən azı `min` kontrasta çatana qədər açır və
 * ya qaraldır. Rəngin çaları qorunur — yalnız işıqlılıq dəyişir.
 *
 * İstiqamət fonun özündən seçilir: tünd fonda ağa doğru, açıq fonda qaraya
 * doğru. Əks istiqamətə getmək rəngi fona yaxınlaşdırıb vəziyyəti pisləşdirərdi.
 *
 * Heç bir qarışıq kifayət etməsə (praktikada olmur, çünki ağ və qara sərhəd
 * hallarıdır), sərhəd rəngi qaytarılır — səssizcə sınmış dəyər yox.
 */
export function readableOn(color: string, background: string, min = 4.5): string {
  const c = parseHex(color);
  const b = parseHex(background);
  if (!c || !b) return color;
  if (contrastRatio(color, background) >= min) return color;

  const target: RGB = luminance(b) > 0.18 ? [0, 0, 0] : [255, 255, 255];

  // Xətti axtarış qəsdəndir, ikili yox: kontrast qarışıq nisbətinə görə monoton
  // artır, amma addım kiçik olanda nəticə də rəngə daha yaxın qalır. 2%-lik
  // addımda ən pis hal 50 iterasiyadır — server komponentində ölçülməz azdır.
  for (let t = 0.02; t <= 1.0001; t += 0.02) {
    const candidate = toHex(mix(c, target, t));
    if (contrastRatio(candidate, background) >= min) return candidate;
  }
  return toHex(target);
}

/**
 * Bərk `background` üzərinə qoyulacaq mətn rəngi: qara və ya ağ — hansı daha
 * yaxşı kontrast verirsə.
 *
 * Filtr pilləri fonu `Game.accentColor`-dan götürüb mətni SABİT `#0a0b10`
 * yazırdı. Üç oyun üçün bu doğru idi, Dota 2 üçün yox: `#dc2626` fonunda tünd
 * mətn 4.07:1 verir (ölçüldü, axe-core 2026-08-30), ağ isə 4.83:1.
 *
 * Ölçülən dəyərlər: CS2 qara 9.63, VALORANT qara 5.86, Dota 2 AĞ 4.83,
 * LoL qara 8.87. Yəni sabit seçim bir oyunda həmişə səhv olacaqdı və növbəti
 * əlavə olunan oyun üçün də zəmanət yox idi — ona görə seçim hesablanır.
 */
export function bestTextOn(background: string, dark = "#0a0b10", light = "#ffffff"): string {
  return contrastRatio(dark, background) >= contrastRatio(light, background) ? dark : light;
}
