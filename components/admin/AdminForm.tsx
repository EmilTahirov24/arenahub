"use client";

import { useActionState } from "react";
import type { AdminSaveState } from "@/lib/adminFormState";

/**
 * Wraps a WHOLE form in the admin panel so its error reaches the screen.
 *
 * [components/admin/AdminRowForm.tsx](AdminRowForm) is for row forms and shows
 * success; this one is for forms that redirect, so its job is showing the
 * ERROR. On success the action takes you to another page anyway.
 *
 * Why it was needed: an error thrown inside a server action lands on the
 * generic error boundary, which says "this did not go through... your session
 * has probably expired". Measured - creating a second tournament under the
 * same name showed exactly that, while the real cause was something else
 * entirely: a duplicate slug. Now the action returns the reason.
 *
 * The fields come through as `children`, so they stay server-rendered.
 */
export default function AdminForm({
  action,
  children,
  submitLabel = "Yadda saxla",
  className = "max-w-lg space-y-4",
  submitClassName,
}: {
  action: (state: AdminSaveState, formData: FormData) => Promise<AdminSaveState>;
  children: React.ReactNode;
  submitLabel?: string;
  className?: string;
  submitClassName: string;
}) {
  const [state, formAction, pending] = useActionState<AdminSaveState, FormData>(action, undefined);

  return (
    <form action={formAction} className={className}>
      {children}

      {/* aria-live: səhv yalnız çəkilmir, ekran oxuyucusuna da bildirilir —
          forma uzundur və dəyişiklik düymənin yanında baş verir. */}
      <div aria-live="polite">
        {!pending && state?.error && (
          <p className="mb-2 rounded-md border border-live/40 bg-live/10 px-3 py-2 text-sm text-live">
            {state.error}
          </p>
        )}
      </div>

      <button type="submit" disabled={pending} className={submitClassName}>
        {pending ? "Saxlanılır…" : submitLabel}
      </button>
    </form>
  );
}
