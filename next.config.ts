import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // Siyahı səhifələri (matches, teams, players, results, stats, events, news)
  // `searchParams` oxuyur. Köhnə modeldə bu, bütün marşrutu dinamik edirdi —
  // nə CDN keşi işə düşürdü, nə də `revalidate` bir şey dəyişirdi, yəni hər
  // ziyarətçi və hər crawler bazaya gedirdi (~1.2s).
  //
  // Cache Components ilə `searchParams` oxunuşu <Suspense> içinə itələnir:
  // səhifənin qalanı statik qabıq kimi prerender olunur, filtrlənmiş hissə isə
  // sorğu zamanı stream ilə gəlir.
  //
  // Bu bayraq `dynamic`/`revalidate` seqment konfiqlərini əvəz edir — onların
  // yerini `use cache` + `cacheLife` tutur. `revalidatePath` dəyişməz işləyir,
  // yəni admin əməliyyatları olduğu kimi qalır.
  cacheComponents: true,
};

export default withNextIntl(nextConfig);
