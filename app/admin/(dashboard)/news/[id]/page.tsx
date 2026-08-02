import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import NewsForm from "@/components/admin/NewsForm";
import { updateNews, deleteNews } from "../actions";
import { dangerButtonClass } from "@/components/admin/formStyles";

export default async function EditNewsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [article, games, teams] = await Promise.all([
    prisma.newsArticle.findUnique({ where: { id }, include: { translations: true } }),
    prisma.game.findMany({ orderBy: { name: "asc" } }),
    prisma.team.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!article) notFound();

  const translations = {
    az: article.translations.find((t) => t.locale === "az"),
    en: article.translations.find((t) => t.locale === "en"),
  };

  const updateWithId = updateNews.bind(null, id);
  const deleteWithId = deleteNews.bind(null, id);

  return (
    <div>
      <h1 className="font-display mb-6 text-2xl font-bold">{translations.az?.title ?? translations.en?.title ?? "Xəbər"}</h1>
      <NewsForm article={article} translations={translations} games={games} teams={teams} action={updateWithId} />
      <form action={deleteWithId} className="mt-8">
        <button type="submit" className={dangerButtonClass}>
          Xəbəri sil
        </button>
      </form>
    </div>
  );
}
