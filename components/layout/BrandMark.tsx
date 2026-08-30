/**
 * ArenaHub nişanı — «A» üçbucağı.
 *
 * Səhifə içi variantdır: plitə YOXDUR və içəridəki üçbucaq `evenodd` ilə
 * kəsilir, yəni deşikdən arxadakı fon görünür. Buna görə nişan həm qaranlıq,
 * həm işıqlı temada işləyir və ayrıca versiya saxlamağa ehtiyac qalmır.
 *
 * Favicon (`app/icon.svg`) və paylaşım şəkilləri (`lib/ogTheme.tsx`) PLİTƏLİ
 * variantdan istifadə edir: onlar brauzer tabı və sosial şəbəkə kimi ixtiyari
 * fonların üstünə düşür, orada öz fonunu daşımaq məcburidir.
 *
 * Qradiyent rəngləri `globals.css`-dəki dəyişənlərdən oxunur — brend rəngi
 * dəyişsə, nişan da dəyişir. `id` sabitdir: eyni səhifədə iki dəfə render
 * olunsa, tərif eyni olduğu üçün toqquşma yaratmır.
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
