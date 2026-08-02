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
          <label className={labelClass}>Oyun</label>
          <select name="gameId" defaultValue={article?.gameId ?? ""} className={inputClass}>
            <option value="">— bütün oyunlar —</option>
            {games.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Əlaqəli komanda</label>
          <select name="relatedTeamId" defaultValue={article?.relatedTeamId ?? ""} className={inputClass}>
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
          <label className={labelClass}>Teqlər (vergüllə ayrılmış)</label>
          <input name="tags" defaultValue={article?.tags?.join(", ") ?? ""} className={inputClass} placeholder="turnir, transfer" />
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
            <label className={labelClass}>Başlıq</label>
            <input name="title_az" required defaultValue={az?.title} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Qısa məzmun</label>
            <input name="excerpt_az" defaultValue={az?.excerpt ?? ""} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Mətn</label>
            <textarea name="bodyHtml_az" required rows={8} defaultValue={az?.bodyHtml} className={inputClass} />
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-border-subtle p-4">
          <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground-muted">English</h2>
          <div>
            <label className={labelClass}>Title</label>
            <input name="title_en" required defaultValue={en?.title} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Excerpt</label>
            <input name="excerpt_en" defaultValue={en?.excerpt ?? ""} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Body</label>
            <textarea name="bodyHtml_en" required rows={8} defaultValue={en?.bodyHtml} className={inputClass} />
          </div>
        </div>
      </div>

      <button type="submit" className={primaryButtonClass}>
        Yadda saxla
      </button>
    </form>
  );
}
