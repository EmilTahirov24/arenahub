"use client";

import { useActionState, useId } from "react";
import Link from "next/link";
import { resetPlayerPassword } from "@/app/player/reset-password/actions";
import type { AuthText } from "@/lib/authStrings";

export default function PlayerResetPasswordForm({ token, text }: { token: string; text: AuthText }) {
  const [state, formAction, pending] = useActionState(resetPlayerPassword, undefined);
  // Etiketi sahəyə bağlayır. Bunsuz ekran oxuyucusu sahəni adsız oxuyur,
  // parol meneceri onu tanımır, etiketə klik isə sahəni fokuslamır.
  // useId seçildi ki, səhifədə ikinci form olsa id-lər toqquşmasın.
  const fieldId = useId();

  return (
    <form action={formAction} className="w-full max-w-sm rounded-xl border border-border-subtle bg-surface p-6">
      <input type="hidden" name="token" value={token} />

      <h1 className="font-display mb-1 text-xl font-bold">
        <span className="brand-gradient-text">ArenaHub</span> {text.brandSuffix}
      </h1>
      <p className="mb-6 text-sm text-foreground-muted">{text.resetSubtitle}</p>

      <label htmlFor={`${fieldId}-password`} className="mb-1 block text-sm font-medium text-foreground-muted">{text.newPassword}</label>
      <input
        id={`${fieldId}-password`}
        name="password"
        type="password"
        required
        minLength={6}
        className="mb-4 w-full rounded-md border border-border-subtle bg-background px-3 py-2 text-sm outline-none focus:border-brand-via"
      />

      <label htmlFor={`${fieldId}-confirmPassword`} className="mb-1 block text-sm font-medium text-foreground-muted">{text.confirmPassword}</label>
      <input
        id={`${fieldId}-confirmPassword`}
        name="confirmPassword"
        type="password"
        required
        minLength={6}
        className="mb-4 w-full rounded-md border border-border-subtle bg-background px-3 py-2 text-sm outline-none focus:border-brand-via"
      />

      {state?.error && <p className="mb-4 text-sm text-live">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="brand-gradient-bg w-full rounded-md py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? text.working : text.resetSubmit}
      </button>

      <p className="mt-4 text-center text-xs text-foreground-muted">
        <Link href="/player/login" className="text-brand-via hover:underline">
          Girişə qayıt
        </Link>
      </p>
    </form>
  );
}
