import Image from "next/image";
import { initials } from "@/lib/initials";
import { avatarPaint } from "@/lib/avatarColor";

export default function PlayerAvatar({
  name,
  photoUrl,
  color,
  size = 40,
}: {
  name: string;
  photoUrl?: string | null;
  color?: string | null;
  size?: number;
}) {
  if (photoUrl) {
    return (
      <Image
        src={photoUrl}
        alt={name}
        width={size}
        height={size}
        unoptimized
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }

  const paint = avatarPaint(name, color);

  return (
    <div
      className="avatar-badge font-display flex shrink-0 items-center justify-center rounded-full font-bold"
      style={
        {
          width: size,
          height: size,
          fontSize: size * 0.36,
          // Komanda avatarı ilə eyni səbəb: /az/players siyahısında da
          // fotosuz oyunçular tam eyni rəngdə idi.
          "--avatar-dark": paint.dark,
          "--avatar-light": paint.light,
          "--avatar-ink-dark": paint.inkDark,
          "--avatar-ink-light": paint.inkLight,
        } as React.CSSProperties
      }
    >
      {initials(name)}
    </div>
  );
}
