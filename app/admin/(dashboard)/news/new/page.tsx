import { prisma } from "@/lib/prisma";
import NewsForm from "@/components/admin/NewsForm";
import { createNews } from "../actions";

export default async function NewNewsPage() {
  const [games, teams] = await Promise.all([
    prisma.game.findMany({ orderBy: { name: "asc" } }),
    prisma.team.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <h1 className="font-display mb-6 text-2xl font-bold">Yeni xəbər</h1>
      <NewsForm games={games} teams={teams} action={createNews} />
    </div>
  );
}
