import Image from "next/image";
import { initials } from "@/lib/initials";

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
  if (logoUrl) {
    return (
      <Image
        src={logoUrl}
        alt={name}
        width={size}
        height={size}
        unoptimized
        className="rounded-md object-cover"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-md font-display font-bold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: `linear-gradient(135deg, ${color ?? "#7c3aed"}, #0a0b10)`,
      }}
    >
      {initials(name)}
    </div>
  );
}
