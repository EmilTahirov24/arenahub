/**
 * The ArenaHub mark - an "A" triangle.
 *
 * This is the in-page variant: there is NO tile, and the inner triangle is cut
 * with `evenodd`, so whatever sits behind shows through the hole. That is what
 * lets the mark work in both the dark and the light theme without keeping a
 * separate version of each.
 *
 * The favicon (`app/icon.svg`) and the share images (`lib/ogTheme.tsx`) use the
 * TILED variant instead: those land on arbitrary backgrounds - a browser tab,
 * a social network - where carrying your own background is compulsory.
 *
 * The gradient colours are read from the variables in `globals.css`, so the
 * mark follows the brand colour. The `id` is fixed: rendered twice on one
 * page, the definitions are identical, so nothing collides.
 */
export default function BrandMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="ArenaHub">
      <defs>
        <linearGradient id="arenahub-mark" x1="7" y1="11" x2="57" y2="53" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--brand-from)" />
          <stop offset="0.52" stopColor="var(--brand-via)" />
          <stop offset="1" stopColor="var(--brand-to)" />
        </linearGradient>
      </defs>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M32 11 L57 53 H7 Z M32 27.5 L44.5 48 H19.5 Z"
        fill="url(#arenahub-mark)"
      />
    </svg>
  );
}
