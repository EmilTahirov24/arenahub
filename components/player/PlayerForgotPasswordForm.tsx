"use client";

import { useActionState, useId } from "react";
import Link from "next/link";
import { requestPlayerPasswordReset } from "@/app/player/forgot-password/actions";
import type { AuthLang, AuthText } from "@/lib/authStrings";

export default function PlayerForgotPasswordForm({ lang, text }: { lang: AuthLang; text: AuthText }) {
  const [state, formAction, pending] = useActionState(requestPlayerPasswordReset, undefined);
  // Etiketi sahəyə bağlayır. Bunsuz ekran oxuyucusu sahəni adsız oxuyur,
  // parol meneceri onu tanımır, etiketə klik isə sahəni fokuslamır.
  // useId seçildi ki, səhifədə ikinci form olsa id-lər toqquşmasın.
  const fieldId = useId();
  const q = lang === "az" ? "" : `?lang=${lang}`;

  return (
    <form action={formAction} className="w-full max-w-sm rounded-xl border border-border-subtle bg-surface p-6">
      <h1 className="font-display mb-1 text-xl font-bold">
        <span className="brand-gradient-text">ArenaHub</span> {text.brandSuffix}
      </h1>
      <p className="mb-6 text-sm text-foreground-muted">{text.forgotSubtitle}</p>

      {state?.success ? (
        <p className="mb-4 text-sm text-foreground">{text.forgotSent}</p>
      ) : (
        <>
          <label htmlFor={`${fieldId}-email`} className="mb-1 block text-sm font-medium text-foreground-muted">{text.email}</label>
          <input
            id={`${fieldId}-email`}
            name="email"
            type="email"
            required
            className="mb-4 w-full rounded-md border border-border-subtle bg-background px-3 py-2 text-sm outline-none focus:border-brand-via"
          />

          {state?.error && <p className="mb-4 text-sm text-live">{state.error}</p>}

          <button
            type="submit"
            disabled={pending}
            className="brand-gradient-bg w-full rounded-md py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {pending ? text.working : text.forgotSubmit}
          </button>
        </>
      )}

      <p className="mt-4 text-center text-xs text-foreground-muted">
        <Link href={`/player/login${q}`} className="text-brand-via hover:underline">
          {text.backToLogin}
        </Link>
      </p>
    </form>
  );
}
