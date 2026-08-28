import ImageUpload from "@/components/forms/ImageUpload";
import { inputClass, labelClass, primaryButtonClass } from "@/components/admin/formStyles";
import type { NewsArticle, NewsArticleTranslation, Game, Team } from "@/app/generated/prisma/client";

export default function NewsForm({
  article,
  translations,
  games,
  teams,
  action,
}: {
  article?: NewsArticle;
  translations?: { az?: NewsArticleTranslation; en?: NewsArticleTranslation };
  games: Game[];
  teams: Team[];
  action: (formData: FormData) => Promise<void>;
}) {
  const az = translations?.az;
  const en = translations?.en;

  return (
    <form action={action} className="max-w-3xl space-y-6">
      <div className="max-w-lg space-y-4">
        <div>
          <label htmlFor="news-gameId" className={labelClass}>Oyun</label>
          <select id="news-gameId" name="gameId" defaultValue={article?.gameId ?? ""} className={inputClass}>
            <option value="">— bütün oyunlar —</option>
            {games.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="news-relatedTeamId" className={labelClass}>Əlaqəli komanda</label>
          <select id="news-relatedTeamId" name="relatedTeamId" defaultValue={article?.relatedTeamId ?? ""} className={inputClass}>
            <option value="">— yoxdur —</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <ImageUpload name="coverImageUrl" label="Üz şəkli" defaultValue={article?.coverImageUrl} />
        <div>
          <label htmlFor="news-tags" className={labelClass}>Teqlər (vergüllə ayrılmış)</label>
          <input id="news-tags" name="tags" defaultValue={article?.tags?.join(", ") ?? ""} className={inputClass} placeholder="turnir, transfer" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isFeatured" defaultChecked={article?.isFeatured ?? false} />
          Seçilmiş
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isPublished" defaultChecked={!!article?.publishedAt} />
          Dərc et
        </label>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3 rounded-lg border border-border-subtle p-4">
          <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground-muted">Azərbaycan</h2>
          <div>
            <label htmlFor="news-title_az" className={labelClass}>Başlıq</label>
            <input id="news-title_az" name="title_az" required defaultValue={az?.title} className={inputClass} />
          </div>
          <div>
            <label htmlFor="news-excerpt_az" className={labelClass}>Qısa məzmun</label>
            <input id="news-excerpt_az" name="excerpt_az" defaultValue={az?.excerpt ?? ""} className={inputClass} />
          </div>
          <div>
            <label htmlFor="news-bodyHtml_az" className={labelClass}>Mətn</label>
            <textarea id="news-bodyHtml_az" name="bodyHtml_az" required rows={8} defaultValue={az?.bodyHtml} className={inputClass} />
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-border-subtle p-4">
          <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground-muted">English</h2>
          <div>
            <label htmlFor="news-title_en" className={labelClass}>Title</label>
            <input id="news-title_en" name="title_en" required defaultValue={en?.title} className={inputClass} />
          </div>
          <div>
            <label htmlFor="news-excerpt_en" className={labelClass}>Excerpt</label>
            <input id="news-excerpt_en" name="excerpt_en" defaultValue={en?.excerpt ?? ""} className={inputClass} />
          </div>
          <div>
            <label htmlFor="news-bodyHtml_en" className={labelClass}>Body</label>
            <textarea id="news-bodyHtml_en" name="bodyHtml_en" required rows={8} defaultValue={en?.bodyHtml} className={inputClass} />
          </div>
        </div>
      </div>

      <button type="submit" className={primaryButtonClass}>
        Yadda saxla
      </button>
    </form>
  );
}
