import { prisma } from "@/lib/prisma";
import TournamentForm from "@/components/admin/TournamentForm";
import { createTournament } from "../actions";


/**
 * Instant navigation is not the goal in the admin panel.
 *
 * These pages read FRESH data from the database on every open - an admin must
 * not be shown yesterday's list. Next reports an uncached read as something
 * that prevents instant navigation and fills the dev console with that warning;
 * the e2e suites collect those as problems, and REAL console errors get lost in
 * the pile.
 *
 * `instant = false` is the documented "Allow blocking route" option: production
 * behaviour does not change, the intent is simply written down.
 */
export const instant = false;

export default async function NewTournamentPage() {
  const games = await prisma.game.findMany({ orderBy: { name: "asc" } });
  return (
    <div>
      <h1 className="font-display mb-6 text-2xl font-bold">Yeni turnir</h1>
      <TournamentForm games={games} action={createTournament} />
    </div>
  );
}
