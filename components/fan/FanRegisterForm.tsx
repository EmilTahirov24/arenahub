"use client";

import { useActionState } from "react";
import Link from "next/link";
import { fanRegister } from "@/app/fan/register/actions";

export default function FanRegisterForm() {
  const [state, formAction, pending] = useActionState(fanRegister, undefined);

  return (
    <form action={formAction} className="w-full max-w-sm rounded-xl border border-border-subtle bg-surface p-6">
      <h1 className="font-display mb-1 text-xl font-bold">
        <span className="brand-gradient-text">ArenaHub</span> İzləyici
      </h1>
      <p className="mb-6 text-sm text-foreground-muted">Matç proqnozu vermək üçün qeydiyyatdan keçin</p>

      <label className="mb-1 block text-sm font-medium text-foreground-muted">İstifadəçi adı</label>
      <input name="username" required className="mb-4 w-full rounded-md border border-border-subtle bg-background px-3 py-2 text-sm outline-none focus:border-brand-via" />

      <label className="mb-1 block text-sm font-medium text-foreground-muted">Email</label>
      <input name="email" type="email" required className="mb-4 w-full rounded-md border border-border-subtle bg-background px-3 py-2 text-sm outline-none focus:border-brand-via" />

      <label className="mb-1 block text-sm font-medium text-foreground-muted">Şifrə</label>
      <input name="password" type="password" required minLength={6} className="mb-4 w-full rounded-md border border-border-subtle bg-background px-3 py-2 text-sm outline-none focus:border-brand-via" />

      <label className="mb-4 flex items-start gap-2 text-xs text-foreground-muted">
        <input type="checkbox" name="terms" required className="mt-0.5" />
        <span>
          <a href="/az/terms" target="_blank" rel="noopener noreferrer" className="text-brand-via hover:underline">
            İstifadə Şərtlərini
          </a>{" "}
          və{" "}
          <a href="/az/privacy" target="_blank" rel="noopener noreferrer" className="text-brand-via hover:underline">
            Məxfilik Siyasətini
          </a>{" "}
          oxudum və qəbul edirəm.
        </span>
      </label>

      {state?.error && <p className="mb-4 text-sm text-live">{state.error}</p>}

      <button type="submit" disabled={pending} className="brand-gradient-bg w-full rounded-md py-2 text-sm font-semibold text-white disabled:opacity-60">
        {pending ? "..." : "Qeydiyyatdan keç"}
      </button>

      <p className="mt-4 text-center text-xs text-foreground-muted">
        Artıq hesabınız var?{" "}
        <Link href="/fan/login" className="text-brand-via hover:underline">
          Daxil olun
        </Link>
      </p>
    </form>
  );
}
