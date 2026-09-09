import { bestTextOn } from "./contrast";

/**
 * A stable colour for a team with no logo.
 *
 * `TeamAvatar` used `primaryColor ?? "#7c3aed"` as its background. The result
 * was measured on the live site (2026-08-30, /az/teams?game=dota2): the page
 * held 102 logo-less avatars and every one of them was the SAME colour,
 * `#7c3aed`. A hundred identical purple squares on one screen do not read as
 * stand-ins for logos; they read as images that failed to load.
 *
 * The colour is derived from the name rather than picked at random, so a team
 * gets the same one on every page and every reload. Server and browser compute
 * it identically, so it cannot cause a hydration mismatch.
 *
 * This is NOT invented data: the colour claims nothing, it only tells rows
 * apart. Where the team's own colour is known (`primaryColor`), that always
 * wins.
 */

/** FNV-1a: short, fast and stable — the same name always yields the same number. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * The hue moves around the circle; saturation and lightness stay fixed.
 *
 * The 28% lightness was not chosen, it was COMPUTED. The avatar carries white
 * text; the first version used 42%, and checking all 360 hues showed the worst
 * case — yellow, h=60, #a9a92d — giving white text just 2.50:1, barely half the
 * WCAG threshold. axe did not report it, because the background is a gradient
 * and the tool skips gradient elements: the number only appeared when measured
 * by hand.
 *
 * Measured thresholds (S=58%): 34% -> 3.71, 32% -> 4.12, 30% -> 4.60,
 * 28% -> 5.14. 30% passes, but sits on the line; 28% keeps a margin.
 */
export function avatarColor(name: string, primaryColor?: string | null): string {
  if (primaryColor) return primaryColor;
  const hue = hash(name.trim().toLowerCase()) % 360;
  return `hsl(${hue} 58% 28%)`;
}

/**
 * The badge's background and ink for both themes.
 *
 * The hue is the same and the lightness is inverted. The reason is not to
 * repeat the dark theme's decision: 28% lightness was chosen for WHITE text,
 * and on a white page that same colour reads as a dark brick — twelve dark
 * discs down the rows of /az/players.
 *
 * The light variant runs from a pale hue to a slightly deeper one and takes
 * dark ink. Worst case measured across all 360 hues, at the DARK end of the
 * gradient:
 *
 *   dark    hsl(h 58% 28%) → #0a0b10, white ink   5.14:1  (h=60, yellow)
 *   light   hsl(h 58% 88%) → hsl(h 58% 72%), dark 6.18:1  (h=240, blue)
 *
 * So the light variant has more headroom than the dark one. It also separates
 * from the white card behind it, by 1.14–1.52.
 *
 * Where the team's own colour is known it is kept in both themes, and the ink
 * is computed against it with `bestTextOn` from lib/contrast.ts.
 */
export type AvatarPaint = {
  dark: string;
  light: string;
  inkDark: string;
  inkLight: string;
};

export function avatarPaint(name: string, primaryColor?: string | null): AvatarPaint {
  if (primaryColor) {
    const ink = bestTextOn(primaryColor);
    return {
      dark: `linear-gradient(135deg, ${primaryColor}, #0a0b10)`,
      light: `linear-gradient(135deg, ${primaryColor}, ${primaryColor})`,
      inkDark: "#ffffff",
      inkLight: ink,
    };
  }

  const hue = hash(name.trim().toLowerCase()) % 360;
  return {
    dark: `linear-gradient(135deg, hsl(${hue} 58% 28%), #0a0b10)`,
    light: `linear-gradient(135deg, hsl(${hue} 58% 88%), hsl(${hue} 58% 72%))`,
    inkDark: "#ffffff",
    inkLight: "#14141f",
  };
}
