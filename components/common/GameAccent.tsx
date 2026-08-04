/**
 * Puts a game's colour into scope as `--game-accent`.
 *
 * Wrap a page section in this and anything inside can use `.game-rule`,
 * `.game-bar` or `.game-edge` (see app/globals.css) without being handed the
 * hex string. The variable is declared in globals.css with the brand colour as
 * its default, so a section that covers every game — the home page, /local —
 * simply does not wrap and gets the brand colour instead.
 *
 * This is what the `--game-accent` token was declared for; until now nothing
 * ever set it.
 */
export default function GameAccent({
  color,
  className,
  children,
}: {
  /** Game.accentColor, or null on pages that span every game. */
  color?: string | null;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className} style={color ? ({ "--game-accent": color } as React.CSSProperties) : undefined}>
      {children}
    </div>
  );
}
