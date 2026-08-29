export const inputClass =
  "w-full rounded-md border border-border-subtle bg-background px-3 py-2 text-sm outline-none focus:border-brand-via";
/**
 * Filtr zolağındakı `<select>` üçün. `inputClass`-dan yeganə fərqi `w-full`-un
 * olmamasıdır: formalarda sahələr sütun-sütun düzülür və tam en düzgündür,
 * axtarış zolağında isə eyni sətirdə dayanmalıdırlar. `inputClass`-a `w-auto`
 * əlavə etmək işləmir — Tailwind-də hər ikisi eyni xüsusiyyətdədir və hansının
 * qalib gəldiyini stil faylındakı sıra həll edir, sinif sətrindəki sıra yox.
 */
export const filterSelectClass =
  "rounded-md border border-border-subtle bg-background px-3 py-2 text-sm outline-none focus:border-brand-via";
export const labelClass = "mb-1 block text-sm font-medium text-foreground-muted";
export const primaryButtonClass =
  "brand-gradient-bg rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60";
export const dangerButtonClass =
  "rounded-md border border-live/40 px-4 py-2 text-sm font-semibold text-live hover:bg-live/10";
export const secondaryButtonClass =
  "rounded-md border border-border-subtle px-4 py-2 text-sm text-foreground-muted hover:bg-surface-raised";
