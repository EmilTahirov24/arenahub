"use client";

import { useActionState } from "react";
import type { AdminSaveState } from "@/lib/adminFormState";

/**
 * Wraps the row forms in the admin panel so a save becomes visible.
 *
 * These forms do not redirect to an edit page, and most of the time they
 * change nothing the eye can catch - the same numbers sit in the same boxes,
 * so the button reads as broken. It has been reported as a bug three times.
 *
 * The fields come through as `children`, which keeps them server-rendered and
 * out of the browser bundle. This component adds only the action binding and
 * the confirmation line.
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
  /** Extra buttons shown on the same row - "Delete", for instance. */
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
