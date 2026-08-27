import { revalidatePath, updateTag } from "next/cache";

/** Keşlənmiş sorğuların teqləri — bax lib/cachedQueries.ts. */
export const CONTENT_TAGS = ["games", "teams", "players", "matches", "tournaments", "news", "ads"] as const;

/**
 * Public məzmun dəyişdi: həm marşrut keşini, həm də keşlənmiş sorğuları ləğv edir.
 *
 * İki ayrı mexanizm var və bunu bilməmək səssiz səhvə aparır: `revalidatePath`
 * MARŞRUT keşi üçündür və `use cache` ilə keşlənmiş SORĞULARA toxunmur. Yalnız
 * birini çağırsaq, dəyişiklik bazada olur, amma saytda görünmür.
 *
 * `updateTag` (revalidateTag deyil) qəsdən seçilib: o, keşi dərhal bitmiş sayır,
 * yəni növbəti sorğu təzə datanı gözləyir. Admin öz dəyişikliyini dərhal
 * görməlidir — AGENTS.md-dəki qayda ilə eyni məntiq.
 *
 * Teqlər geniş götürülür. Dəqiq seçim mümkündür, amma 14 ayrı əməliyyat faylında
 * onu yarımçıq etmək riski faydasından böyükdür; admin əməliyyatları nadirdir,
 * artıq ləğvetmənin qiyməti isə bir neçə təkrar sorğudur.
 */
export function revalidatePublicContent() {
  revalidatePath("/[locale]", "layout");
  for (const tag of CONTENT_TAGS) updateTag(tag);
}
