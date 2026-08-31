"use client";

import { useActionState } from "react";
import type { AdminSaveState } from "@/lib/adminFormState";

/**
 * Admin panelindəki BÜTÖV formaları bükür ki, səhv ekranda görünsün.
 *
 * [components/admin/AdminRowForm.tsx](AdminRowForm) sətir formaları üçündür və
 * uğuru göstərir; bu isə yönləndirən formalar üçündür, yəni əsas işi SƏHVİ
 * göstərməkdir. Uğur olanda action onsuz da başqa səhifəyə aparır.
 *
 * Niyə lazım oldu: server action-da atılan xəta ümumi səhv sərhəddinə düşür və
 * orada «Bu əməliyyat yerinə yetirilmədi… çox güman sessiyanız bitib» yazılır.
 * Ölçüldü — eyni adla ikinci turnir yaradanda admin məhz bunu görürdü, halbuki
 * səbəb tamam başqa idi: slug təkrarlanır. İndi action səbəbi qaytarır.
 *
 * Sahələr `children` kimi ötürülür — serverdə render olunmuş qalır.
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
