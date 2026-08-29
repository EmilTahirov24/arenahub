import Image from "next/image";
import AdImpression from "@/components/ads/AdImpression";
import { getAd } from "@/lib/ads";
import type { AdPlacement } from "@/app/generated/prisma/client";

const SIZE_BY_PLACEMENT: Record<AdPlacement, { w: number; h: number }> = {
  HEADER: { w: 728, h: 90 },
  SIDEBAR_LEFT: { w: 160, h: 600 },
  SIDEBAR_RIGHT_TOP: { w: 300, h: 250 },
  SIDEBAR_RIGHT_BOTTOM: { w: 300, h: 250 },
  IN_CONTENT: { w: 468, h: 60 },
  MATCH_PAGE_TOP: { w: 728, h: 90 },
  FOOTER: { w: 728, h: 90 },
};

export default async function AdSlot({
  placement,
  className = "",
}: {
  placement: AdPlacement;
  className?: string;
}) {
  const ad = await getAd(placement);
  if (!ad) return null;

  const { w, h } = SIZE_BY_PLACEMENT[placement];

  return (
    <div className={`overflow-hidden rounded-lg border border-border-subtle bg-surface ${className}`}>
      {/* Göstərilmə sayğacı. Qutunun İÇİNDƏ durur, çünki müşahidəçi öz valideyn
          elementini izləyir — yəni ölçülən şey məhz bu bannerin sahəsidir. */}
      <AdImpression adId={ad.id} />
      {/* Opasite modifikatoru yoxdur: `/60` bu etiketi 2.94:1-ə salırdı
          (axe-core, hər iki temada). Reklam etiketi qanuni tələbdir — onu
          oxunmaz etmək solğunlaşdırmaqdan pisdir. */}
      <span className="block px-2 pt-1 text-[10px] uppercase tracking-wide text-foreground-muted">
        Reklam
      </span>
      {/* Link reklamçıya birbaşa yox, sayğac marşrutundan keçir — bax
          app/api/ads/[id]/click/route.ts. */}
      <a href={`/api/ads/${ad.id}/click`} target="_blank" rel="noopener noreferrer sponsored">
        <Image
          src={ad.imageUrl}
          alt={ad.altText ?? ad.name}
          width={w}
          height={h}
          unoptimized
          className="h-auto w-full"
        />
      </a>
    </div>
  );
}
