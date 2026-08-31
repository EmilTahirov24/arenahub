/**
 * Admin panelindəki sətir formalarının qaytardığı vəziyyət.
 *
 * `useActionState` ilə işləyən formalar bunu qaytarır ki, saxlamağın baş verdiyi
 * ekranda görünsün — AGENTS.md-dəki qayda: forma ya yönləndirməli, ya görünən
 * nəyisə dəyişməli, ya da mesaj qaytarmalıdır.
 */
export type AdminSaveState =
  | {
      ok?: boolean;
      error?: string;
      /**
       * Uğurlu, amma izah tələb edən nəticə — səhv deyil.
       *
       * Məsələn mükafat sətri əlavə etmək əvəzinə mövcud sətri əvəzləyəndə:
       * əməliyyat baş tutub, sadəcə istifadəçinin gözlədiyindən fərqli olub.
       * «Yadda saxlanıldı ✓» bunu gizlədərdi.
       */
      note?: string;
    }
  | undefined;
