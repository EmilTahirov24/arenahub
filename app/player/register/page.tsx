import { prisma } from "@/lib/prisma";
import PlayerRegisterForm from "@/components/player/PlayerRegisterForm";

export default async function PlayerRegisterPage() {
  const games = await prisma.game.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <PlayerRegisterForm games={games} />
    </div>
  );
}
