export const inputClass =
  "w-full rounded-md border border-border-subtle bg-background px-3 py-2 text-sm outline-none focus:border-brand-via";
/**
 * For the `<select>` in the filter bar. The only difference from `inputClass`
 * is the missing `w-full`: in a form the fields stack in a column and full
 * width is right, while in the search bar they have to sit on one line.
 * Adding `w-auto` to `inputClass` does not work - in Tailwind both set the
 * same property, and which one wins is decided by their order in the
 * stylesheet, not their order in the class string.
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
