"use client";

import { useActionState } from "react";
import type { AdminSaveState } from "@/lib/adminFormState";

/**
 * Admin panelindəki sətir formalarını bükür ki, saxlamağın nəticəsi görünsün.
 *
 * Bu formalar redaktə səhifəsinə yönləndirmir və çox vaxt ekranda gözlə seçilən
 * heç nəyi dəyişmir — istifadəçi eyni rəqəmləri eyni qutularda görür, ona görə
 * düymə işləmirmiş kimi qəbul olunur. Üç dəfə səhv kimi bildirilib.
 *
 * Sahələr `children` kimi ötürülür — yəni serverdə render olunmuş qalır və
 * brauzerə göndərilmir. Bu komponent yalnız action bağlantısını və təsdiq
 * sətrini əlavə edir.
 */
export default function AdminRowForm({
  action,
  children,
  submitLabel,
  submitClassName,
  className,
  trailing,
}: {
  action: (state: AdminSaveState, formData: FormData) => Promise<AdminSaveState>;
  children: React.ReactNode;
  submitLabel: string;
  submitClassName: string;
  className?: string;
  /** Eyni sətirdə göstərilən əlavə düymələr — məsələn «Sil». */
  trailing?: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState<AdminSaveState, FormData>(action, undefined);

  return (
    <form action={formAction} className={className}>
      {children}

      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={pending} className={submitClassName}>
          {pending ? "…" : submitLabel}
        </button>
        {trailing}

        {/* aria-live: təsdiq yalnız çəkilmir, həm də səsləndirilir — düymənin
            özündə başqa heç bir əlamət yoxdur. */}
        <span aria-live="polite" className="text-xs">
          {!pending && state?.ok && !state.note && <span className="text-positive">Yadda saxlanıldı ✓</span>}
          {!pending && state?.note && <span className="text-brand-via-fg">{state.note}</span>}
          {!pending && state?.error && <span className="text-live">{state.error}</span>}
        </span>
      </div>
    </form>
  );
}
