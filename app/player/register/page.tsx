import PlayerRegisterForm from "@/components/player/PlayerRegisterForm";
import { AUTH_TEXT, pickLang } from "@/lib/authStrings";
import { activeGames } from "@/lib/cachedQueries";

export default async function PlayerRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const { lang: raw } = await searchParams;
  const lang = pickLang(raw);
  const games = await activeGames();

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <PlayerRegisterForm games={games} lang={lang} text={AUTH_TEXT[lang]} />
    </main>
  );
}
