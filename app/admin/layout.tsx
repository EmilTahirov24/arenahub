import { connection } from "next/server";

/**
 * Admin paneli qəsdən bloklayan marşrutdur.
 *
 * Cache Components hər marşrutun ani açılmasını gözləyir və prerender oluna
 * bilməyən yerləri xəta kimi göstərir. Buradakı hər səhifə ya sessiya oxuyur, ya da giriş formasıdır — yəni məzmun
 * istifadəçiyə görə dəyişir və statik qabığın verəcəyi bir şey yoxdur. Onu
 * <Suspense> ilə parçalamaq da mənasızdır: gözlədilən hissə elə səhifənin özüdür.
 * Keşləmə public sayt üçün vacibdir, bunun üçün deyil.
 *
 * Bu layout yalnız konfiq üçün var; markup əlavə etmir. Giriş səhifələri client
 * komponentdir və `instant` orada işləmir, ona görə konfiq valideyndə olmalıdır.
 *
 * `connection()` isə bütün budağı sorğu vaxtına bağlayır. Onsuz Next hər səhifəni
 * prerender etməyə çalışır və render zamanı sabit olmayan hər dəyər — məsələn
 * reklam formasının "bu gün" defaultu — xəta verir.
 */
export const instant = false;

export default async function AdminpaneliLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();
  return <>{children}</>;
}
