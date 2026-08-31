import Image from "next/image";
import { initials } from "@/lib/initials";
import { avatarColor } from "@/lib/avatarColor";

/**
 * Loqo xanası hündürlüyündən genişdir.
 *
 * Səbəb ölçüldü (2026-08-31): Liquipedia komandaların böyük hissəsi üçün yalnız
 * GENİŞ söznişan verir — Vitality 3.46, LOUD 5.4 nisbətində. Kvadrat xanada
 * belə loqo 28 piksel enində cəmi 8 piksel hündürlükdə çıxırdı, yanındakı
 * Spirit isə 24×28 — eyni sətirdə üç dəfə fərq. Liquipedia-da ikon variantı
 * axtarıldı və əksər komandada YOXDUR, yəni düzəliş bizim tərəfdə olmalıdır.
 *
 * Xana bütün avatarlarda eyni endədir, ona görə yanındakı adlar cərgə boyu
 * düz sıralanır. Loqosu olmayan komanda əvvəlki kimi kvadrat nişan alır və
 * həmin enin ortasında durur.
 */
const SLOT = 1.45;

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
      <Image
        src={logoUrl}
        alt={name}
        width={slotWidth}
        height={size}
        unoptimized
        /* `contain`, `cover` deyil: kvadrat olmayan xanada `cover` loqonun
           yanlarını kəsərdi və söznişandan yalnız orta hərflər qalardı. */
        className="shrink-0 object-contain"
        style={{ width: slotWidth, height: size }}
      />
    );
  }

  return (
    <div className="flex shrink-0 items-center justify-center" style={{ width: slotWidth, height: size }}>
      <div
        className="flex items-center justify-center rounded-md font-display font-bold text-white"
        style={{
          width: size,
          height: size,
          fontSize: size * 0.36,
          background: `linear-gradient(135deg, ${avatarColor(name, color)}, #0a0b10)`,
        }}
      >
        {initials(name)}
      </div>
    </div>
  );
}
