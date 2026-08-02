import Image from "next/image";
import { initials } from "@/lib/initials";

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

  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-display font-bold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: `linear-gradient(135deg, ${color ?? "#d946ef"}, #0a0b10)`,
      }}
    >
      {initials(name)}
    </div>
  );
}
