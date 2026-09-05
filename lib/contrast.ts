/**
 * Makes text colours readable against the surface behind them.
 *
 * Why this exists: `Game.accentColor` is entered in the admin panel, so it is an
 * arbitrary colour. `GameChip` used it both as the text and as its own washed
 * background, and the result was measured with axe-core on the live site
 * (2026-08-30):
 *
 *   dark theme:   Dota 2 #dc2626 -> 3.39:1   (4.5 required)
 *   light theme:  CS2 #f5a524 -> 1.90:1, LoL #c9aa71 -> 2.07:1,
 *                 VALORANT #ff4655 -> 2.97:1, Dota 2 -> 4.13:1
 *
 * In light mode ALL FOUR games failed. It never appeared in a report because
 * axe scans the default theme only, and because it skips elements sitting on a
 * gradient.
 *
 * Correcting the four colours by hand would not be a fix: an admin can add a
 * fifth game tomorrow in any colour at all. So the correction is computed.
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

/** One sRGB channel as linear luminance (the WCAG 2.x formula). */
function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function luminance(rgb: RGB): number {
  return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
}

/** WCAG contrast ratio between two colours: 1 (identical) to 21 (black on white). */
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

/** Flattens a translucent colour onto its background and returns the solid result. */
export function composite(fg: string, alpha: number, bg: string): string {
  const f = parseHex(fg);
  const b = parseHex(bg);
  if (!f || !b) return bg;
  return toHex(f.map((c, i) => c * alpha + b[i] * (1 - alpha)) as RGB);
}

/**
 * Lightens or darkens `color` until it reaches at least `min` contrast against
 * `background`. The hue is preserved; only the lightness moves.
 *
 * The direction is taken from the background itself: towards white on a dark
 * ground, towards black on a light one. Going the other way would move the
 * colour closer to the background and make things worse.
 *
 * If no mix is enough — which does not happen in practice, since white and
 * black are the limits — the boundary colour is returned rather than a value
 * that silently fails.
 */
export function readableOn(color: string, background: string, min = 4.5): string {
  const c = parseHex(color);
  const b = parseHex(background);
  if (!c || !b) return color;
  if (contrastRatio(color, background) >= min) return color;

  const target: RGB = luminance(b) > 0.18 ? [0, 0, 0] : [255, 255, 255];

  // A linear scan rather than a binary search, on purpose: contrast rises
  // monotonically with the mix ratio, but a small step also keeps the result
  // closer to the original colour. At 2% the worst case is 50 iterations,
  // which is immeasurably cheap inside a server component.
  for (let t = 0.02; t <= 1.0001; t += 0.02) {
    const candidate = toHex(mix(c, target, t));
    if (contrastRatio(candidate, background) >= min) return candidate;
  }
  return toHex(target);
}

/**
 * Text colour to put on a solid `background`: black or white, whichever gives
 * the better contrast.
 *
 * The filter pills took their background from `Game.accentColor` and wrote the
 * text in a FIXED `#0a0b10`. That was right for three games and wrong for
 * Dota 2: on `#dc2626` the dark text gives 4.07:1 and white gives 4.83:1
 * (measured with axe-core, 2026-08-30).
 *
 * The measured values: CS2 black 9.63, VALORANT black 5.86, Dota 2 WHITE 4.83,
 * LoL black 8.87. A fixed choice was always going to be wrong for one game, and
 * nothing guaranteed the next game added would be any kinder — so the choice is
 * computed instead.
 */
export function bestTextOn(background: string, dark = "#0a0b10", light = "#ffffff"): string {
  return contrastRatio(dark, background) >= contrastRatio(light, background) ? dark : light;
}
