import { initials } from "@/lib/initials";
import { avatarPaint } from "@/lib/avatarColor";

/**
 * The logo box is wider than it is tall.
 *
 * The reason was measured (2026-08-31): for most teams Liquipedia offers only
 * a WIDE wordmark - Vitality at a ratio of 3.46, LOUD at 5.4. In a square box
 * such a logo came out 28 pixels wide and just 8 tall, while Spirit beside it
 * was 24x28 - a threefold difference on one line. An icon variant was looked
 * for on Liquipedia and most teams do NOT have one, so the fix has to be on
 * our side.
 *
 * The box is the same width for every avatar, so the names beside them line up
 * down the column. A team without a logo still gets the square badge, centred
 * in that width.
 */
const SLOT = 1.45;

/**
 * The address of the variant that works on a white background.
 *
 * Liquipedia keeps every logo in two forms and the importer downloads both
 * (`scripts/fetch-team-logos.ts`): `<slug>.png` for a dark background,
 * `<slug>-light.png` for a light one. This matters, and was measured - 58 of
 * 127 logos are ENTIRELY WHITE and were completely invisible on a white card
 * in the light theme.
 *
 * The file always exists: where there is no separate light variant, the
 * importer writes the same image under the second name, so nothing needs
 * checking here.
 *
 * Logos uploaded through the admin panel (blob storage) stay out of this
 * naming scheme and are left as they are - whoever uploads one picks the
 * background themselves.
 */
function lightVariant(url: string): string {
  return url.startsWith("/teams/") ? url.replace(/\.png$/, "-light.png") : url;
}

export default function TeamAvatar({
  name,
  logoUrl,
  color,
  size = 32,
}: {
  name: string;
  logoUrl?: string | null;
  color?: string | null;
  size?: number;
}) {
  const slotWidth = Math.round(size * SLOT);

  if (logoUrl) {
    return (
      <span
        role="img"
        aria-label={name}
        className="team-logo shrink-0"
        style={
          {
            width: slotWidth,
            height: size,
            "--logo-dark": `url("${logoUrl}")`,
            "--logo-light": `url("${lightVariant(logoUrl)}")`,
          } as React.CSSProperties
        }
      />
    );
  }

  const paint = avatarPaint(name, color);

  return (
    <div className="flex shrink-0 items-center justify-center" style={{ width: slotWidth, height: size }}>
      <div
        className="avatar-badge font-display flex items-center justify-center rounded-md font-bold"
        style={
          {
            width: size,
            height: size,
            fontSize: size * 0.36,
            "--avatar-dark": paint.dark,
            "--avatar-light": paint.light,
            "--avatar-ink-dark": paint.inkDark,
            "--avatar-ink-light": paint.inkLight,
          } as React.CSSProperties
        }
      >
        {initials(name)}
      </div>
    </div>
  );
}
