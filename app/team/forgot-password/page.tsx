"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestTeamPasswordReset } from "./actions";

export default function TeamForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(requestTeamPasswordReset, undefined);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form action={formAction} className="w-full max-w-sm rounded-xl border border-border-subtle bg-surface p-6">
        <h1 className="font-display mb-1 text-xl font-bold">
          <span className="brand-gradient-text">ArenaHub</span> Komanda
        </h1>
        <p className="mb-6 text-sm text-foreground-muted">Şifrənizi unutmusunuz?</p>

        {state?.success ? (
          <p className="mb-4 text-sm text-foreground">
            Əgər bu email ilə qeydiyyatdan keçmiş komanda varsa, şifrə sıfırlama linki göndərildi. Zəhmət olmasa
            emailinizi yoxlayın.
          </p>
        ) : (
          <>
            <label className="mb-1 block text-sm font-medium text-foreground-muted">Email</label>
            <input
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
              {pending ? "..." : "Sıfırlama linki göndər"}
            </button>
          </>
        )}

        <p className="mt-4 text-center text-xs text-foreground-muted">
          <Link href="/team/login" className="text-brand-via hover:underline">
            Girişə qayıt
          </Link>
        </p>
      </form>
    </div>
  );
}
