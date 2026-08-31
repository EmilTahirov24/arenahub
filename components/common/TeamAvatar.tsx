import { initials } from "@/lib/initials";
import { avatarPaint } from "@/lib/avatarColor";

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

/**
 * Ağ fonda işləyən variantın ünvanı.
 *
 * Liquipedia hər loqonu iki cür saxlayır və idxal ikisini də endirir
 * (`scripts/fetch-team-logos.ts`): `<slug>.png` tünd fon üçün, `<slug>-light.png`
 * açıq fon üçün. Bu vacibdir, ölçüldü — 127 loqonun 58-i TAM AĞDIR və işıqlı
 * temada ağ kartda tamamilə görünmürdü.
 *
 * Fayl həmişə mövcuddur: ayrıca işıqlı variant olmayanda idxal eyni şəkli
 * ikinci ad altında yazır, ona görə burada yoxlama lazım deyil.
 *
 * Admin panelindən yüklənən loqolar (blob storage) bu adlandırmaya girmir və
 * olduğu kimi qalır — onları yükləyən adam fonu özü seçir.
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
