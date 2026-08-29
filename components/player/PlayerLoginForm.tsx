"use client";

import { Suspense, useActionState, useId } from "react";
import Link from "next/link";
import VerifyStatusBanner from "@/components/auth/VerifyStatusBanner";
import { playerLogin } from "@/app/player/login/actions";
import type { AuthLang, AuthText } from "@/lib/authStrings";

/**
 * Giriş forması.
 *
 * Səhifədən ayrıldı ki, dil serverdə seçilə bilsin: `/player` [locale]-dən
 * kənardadır, ona görə dil ünvandan yox, `?lang=` sorğu parametrindən gəlir və
 * onu server komponenti oxuyur.
 */
export default function PlayerLoginForm({ lang, text }: { lang: AuthLang; text: AuthText }) {
  const [state, formAction, pending] = useActionState(playerLogin, undefined);
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
      <p className="mb-6 text-sm text-foreground-muted">{text.loginSubtitle}</p>

      <Suspense fallback={null}>
        <VerifyStatusBanner />
      </Suspense>

      <label htmlFor={`${fieldId}-email`} className="mb-1 block text-sm font-medium text-foreground-muted">{text.email}</label>
      <input id={`${fieldId}-email`} name="email" type="email" required className="mb-4 w-full rounded-md border border-border-subtle bg-background px-3 py-2 text-sm outline-none focus:border-brand-via" />

      <label htmlFor={`${fieldId}-password`} className="mb-1 block text-sm font-medium text-foreground-muted">{text.password}</label>
      <input id={`${fieldId}-password`} name="password" type="password" required className="mb-1 w-full rounded-md border border-border-subtle bg-background px-3 py-2 text-sm outline-none focus:border-brand-via" />

      <p className="mb-4 text-right text-xs">
        <Link href={`/player/forgot-password${q}`} className="text-brand-via-fg hover:underline">
          {text.forgotLink}
        </Link>
      </p>

      {state?.error && <p className="mb-4 text-sm text-live">{state.error}</p>}

      <button type="submit" disabled={pending} className="brand-gradient-bg w-full rounded-md py-2 text-sm font-semibold text-white disabled:opacity-60">
        {pending ? text.working : text.loginSubmit}
      </button>

      <p className="mt-4 text-center text-xs text-foreground-muted">
        {text.noAccount}{" "}
        <Link href={`/player/register${q}`} className="text-brand-via-fg hover:underline">
          {text.goRegister}
        </Link>
      </p>
    </form>
  );
}
