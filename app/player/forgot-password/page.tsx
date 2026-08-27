import PlayerForgotPasswordForm from "@/components/player/PlayerForgotPasswordForm";
import { AUTH_TEXT, pickLang } from "@/lib/authStrings";

export default async function PlayerForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const { lang: raw } = await searchParams;
  const lang = pickLang(raw);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <PlayerForgotPasswordForm lang={lang} text={AUTH_TEXT[lang]} />
    </div>
  );
}
