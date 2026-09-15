import { composite, readableOn } from "@/lib/contrast";

// A chip's background is the accent colour at 10%, so legibility is computed
// against that blend rather than against a clean surface.
//
// The surfaces are the WORST case among those in `globals.css`, which in both
// themes is the lightest one - `--surface-raised`. The reason is the same
// either way: the closer the background gets to the lightness of the text, the
// less contrast there is.
//
// This was picked wrongly on the first attempt: `#ffffff` was written for the
// light theme, the most optimistic case. The computed colours came out at
// 4.06-4.32 - fixed, and still under the threshold. The measured backgrounds
// (`#f1e9e2`, `#f2dfe7`, `#eedce2`, `#ece9ea`) line up with `--surface-raised`
// exactly. The light value is NOT `--surface-raised` (#f0f0f7) but slightly
// darker than it.
//
// The reason was measured on 2026-08-31: once the hero band's brand tint was
// strengthened (`globals.css`, --ambient-a/b), the worst background under the
// chips was no longer the lightest SURFACE but that tint. axe reported
// 4.34-4.43 for four chips, against a threshold of 4.5.
//
// The value is not invented: the darkest point of a REAL pixel under the hero
// text was measured in the browser and came out at #e4e4f4. The chips sit
// below that, where the background is lighter still - so this value errs on
// the cautious side.
const DARK_SURFACE = "#171a22";
const LIGHT_SURFACE = "#e4e4f4";

export default function GameChip({
  name,
  color,
  className = "",
}: {
  name: string;
  color: string;
  className?: string;
}) {
  // Two colours are computed, because the same accent has to move in opposite
  // directions in the two themes: lighter on a dark background, darker on a
  // light one. An inline style cannot react to the theme, so both are handed
  // over as CSS variables and the rule in `globals.css` picks one.
  const onDark = readableOn(color, composite(color, 0.1, DARK_SURFACE));
  const onLight = readableOn(color, composite(color, 0.1, LIGHT_SURFACE));

  return (
    <span
      className={`game-chip inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${className}`}
      style={
        {
          "--chip-fg-dark": onDark,
          "--chip-fg-light": onLight,
          backgroundColor: `${color}1a`,
          border: `1px solid ${color}40`,
        } as React.CSSProperties
      }
    >
      {name}
    </span>
  );
}
