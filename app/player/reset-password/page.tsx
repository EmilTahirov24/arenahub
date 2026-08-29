import Link from "next/link";
import PlayerResetPasswordForm from "@/components/player/PlayerResetPasswordForm";
import { AUTH_TEXT, pickLang } from "@/lib/authStrings";

export default async function PlayerResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; lang?: string }>;
}) {
  const { token, lang: raw } = await searchParams;
  const lang = pickLang(raw);
  const text = AUTH_TEXT[lang];
  const q = lang === "az" ? "" : `?lang=${lang}`;

  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-xl border border-border-subtle bg-surface p-6 text-center">
          <p className="mb-4 text-sm text-live">{text.resetInvalid}</p>
          <Link href={`/player/forgot-password${q}`} className="text-sm text-brand-via-fg hover:underline">
            {text.resetRetry}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <PlayerResetPasswordForm token={token} text={text} />
    </main>
  );
}
