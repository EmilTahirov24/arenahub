/**
 * Admin panelindəki sətir formalarının qaytardığı vəziyyət.
 *
 * `useActionState` ilə işləyən formalar bunu qaytarır ki, saxlamağın baş verdiyi
 * ekranda görünsün — AGENTS.md-dəki qayda: forma ya yönləndirməli, ya görünən
 * nəyisə dəyişməli, ya da mesaj qaytarmalıdır.
 */
export type AdminSaveState = { ok?: boolean; error?: string } | undefined;
