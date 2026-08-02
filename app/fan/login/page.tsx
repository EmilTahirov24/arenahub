"use client";

import { Suspense, useActionState } from "react";
import Link from "next/link";
import VerifyStatusBanner from "@/components/auth/VerifyStatusBanner";
import { fanLogin } from "./actions";

export default function FanLoginPage() {
  const [state, formAction, pending] = useActionState(fanLogin, undefined);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form action={formAction} className="w-full max-w-sm rounded-xl border border-border-subtle bg-surface p-6">
        <h1 className="font-display mb-1 text-xl font-bold">
          <span className="brand-gradient-text">ArenaHub</span> İzləyici
        </h1>
        <p className="mb-6 text-sm text-foreground-muted">İzləyici panelinə giriş</p>

        <Suspense fallback={null}>
          <VerifyStatusBanner />
        </Suspense>

        <label className="mb-1 block text-sm font-medium text-foreground-muted">Email</label>
        <input name="email" type="email" required className="mb-4 w-full rounded-md border border-border-subtle bg-background px-3 py-2 text-sm outline-none focus:border-brand-via" />

        <label className="mb-1 block text-sm font-medium text-foreground-muted">Şifrə</label>
        <input name="password" type="password" required className="mb-1 w-full rounded-md border border-border-subtle bg-background px-3 py-2 text-sm outline-none focus:border-brand-via" />

        <p className="mb-4 text-right text-xs">
          <Link href="/fan/forgot-password" className="text-brand-via hover:underline">
            Şifrəni unutmusunuz?
          </Link>
        </p>

        {state?.error && <p className="mb-4 text-sm text-live">{state.error}</p>}

        <button type="submit" disabled={pending} className="brand-gradient-bg w-full rounded-md py-2 text-sm font-semibold text-white disabled:opacity-60">
          {pending ? "..." : "Daxil ol"}
        </button>

        <p className="mt-4 text-center text-xs text-foreground-muted">
          Hesabınız yoxdur?{" "}
          <Link href="/fan/register" className="text-brand-via hover:underline">
            Qeydiyyatdan keçin
          </Link>
        </p>
      </form>
    </div>
  );
}
