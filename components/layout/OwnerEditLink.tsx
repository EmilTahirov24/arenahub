"use client";

import { useAccount } from "./AccountContext";

/**
 * «Redaktə et» linki — yalnız sahibinə.
 *
 * Əvvəl bu qərar serverdə verilirdi: səhifə `getPlayerSession()` çağırıb
 * baxanın həmin profilin/komandanın sahibi olub-olmadığını yoxlayırdı. Bir link
 * üçün ödənilən qiymət isə bütün oyunçu və komanda səhifələrinin (1400-dən çox)
 * keşlənə bilməməsi idi — `cookies()` oxumaq marşrutu dinamik edir.
 *
 * İndi müqayisə client tərəfdə aparılır, səhifənin özü isə keşlənir. Link
 * hidrasiyadan sonra görünür; bu, yalnız sahibin gördüyü ikinci dərəcəli
 * affordance olduğu üçün qəbul ediləndir.
 */
export default function OwnerEditLink({
  href,
  label,
  match,
  className,
}: {
  href: string;
  label: string;
  /** Baxanın bu səhifənin sahibi olub-olmadığını müəyyən edən uyğunluq. */
  match: { kind: "player"; slug: string } | { kind: "team"; slug: string };
  className?: string;
}) {
  const { account } = useAccount();
  if (!account) return null;

  const mine =
    match.kind === "player" ? account.slug === match.slug : account.ownedTeamSlug === match.slug;
  if (!mine) return null;

  // /player [locale] seqmentindən kənardadır, ona görə adi <a> — i18n Link
  // ünvana dil prefiksi əlavə edərdi.
  return (
    <a href={href} className={className}>
      {label}
    </a>
  );
}
