import PlayerLoginForm from "@/components/player/PlayerLoginForm";
import { AUTH_TEXT, pickLang } from "@/lib/authStrings";

export default async function PlayerLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const { lang: raw } = await searchParams;
  const lang = pickLang(raw);

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <PlayerLoginForm lang={lang} text={AUTH_TEXT[lang]} />
    </main>
  );
}
