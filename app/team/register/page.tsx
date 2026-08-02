import { prisma } from "@/lib/prisma";
import TeamRegisterForm from "@/components/team/TeamRegisterForm";

export default async function TeamRegisterPage() {
  const games = await prisma.game.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <TeamRegisterForm games={games} />
    </div>
  );
}
