"use client";

import { useActionState, useId } from "react";
import Link from "next/link";
import CountrySelect from "@/components/forms/CountrySelect";
import { playerRegister } from "@/app/player/register/actions";
import type { Game } from "@/app/generated/prisma/client";
import type { AuthLang, AuthText } from "@/lib/authStrings";

export default function PlayerRegisterForm({
  games,
  lang,
  text,
}: {
  games: Game[];
  lang: AuthLang;
  text: AuthText;
}) {
  const [state, formAction, pending] = useActionState(playerRegister, undefined);
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
      <p className="mb-6 text-sm text-foreground-muted">{text.registerSubtitle}</p>

      <label htmlFor={`${fieldId}-nickname`} className="mb-1 block text-sm font-medium text-foreground-muted">{text.nickname}</label>
      <input id={`${fieldId}-nickname`} name="nickname" required className="mb-4 w-full rounded-md border border-border-subtle bg-background px-3 py-2 text-sm outline-none focus:border-brand-via" />

      <label htmlFor={`${fieldId}-gameId`} className="mb-1 block text-sm font-medium text-foreground-muted">{text.game}</label>
      <select id={`${fieldId}-gameId`} name="gameId" required className="mb-4 w-full rounded-md border border-border-subtle bg-background px-3 py-2 text-sm outline-none focus:border-brand-via">
        <option value="">{text.choose}</option>
        {games.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </select>

      <label htmlFor={`${fieldId}-country`} className="mb-1 block text-sm font-medium text-foreground-muted">{text.country}</label>
      <div className="mb-4">
        <CountrySelect id={`${fieldId}-country`} className="w-full rounded-md border border-border-subtle bg-background px-3 py-2 text-sm outline-none focus:border-brand-via" />
      </div>

      <label htmlFor={`${fieldId}-email`} className="mb-1 block text-sm font-medium text-foreground-muted">{text.email}</label>
      <input id={`${fieldId}-email`} name="email" type="email" required className="mb-4 w-full rounded-md border border-border-subtle bg-background px-3 py-2 text-sm outline-none focus:border-brand-via" />

      <label htmlFor={`${fieldId}-password`} className="mb-1 block text-sm font-medium text-foreground-muted">{text.password}</label>
      <input id={`${fieldId}-password`} name="password" type="password" required minLength={6} className="mb-4 w-full rounded-md border border-border-subtle bg-background px-3 py-2 text-sm outline-none focus:border-brand-via" />

      <label className="mb-4 flex items-start gap-2 text-xs text-foreground-muted">
        <input type="checkbox" name="terms" required className="mt-0.5" />
        {/* Linklər adamın gördüyü dildə açılır. Əvvəl /az/terms-ə sabit
            bağlanmışdı, yəni ingilis saytdan gələn adamdan oxuya bilmədiyi
            dildə hüquqi mətni qəbul etməsi istənilirdi. */}
        <span>
          {text.termsPrefix}
          <a href={`/${lang}/terms`} target="_blank" rel="noopener noreferrer" className="text-brand-via hover:underline">
            {text.termsLink}
          </a>
          {text.termsAnd}
          <a href={`/${lang}/privacy`} target="_blank" rel="noopener noreferrer" className="text-brand-via hover:underline">
            {text.privacyLink}
          </a>
          {text.termsSuffix}
        </span>
      </label>

      {state?.error && <p className="mb-4 text-sm text-live">{state.error}</p>}

      <button type="submit" disabled={pending} className="brand-gradient-bg w-full rounded-md py-2 text-sm font-semibold text-white disabled:opacity-60">
        {pending ? text.working : text.registerSubmit}
      </button>

      <p className="mt-4 text-center text-xs text-foreground-muted">
        {text.haveAccount}{" "}
        <Link href={`/player/login${q}`} className="text-brand-via hover:underline">
          {text.goLogin}
        </Link>
      </p>
    </form>
  );
}
