import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { primaryButtonClass } from "@/components/admin/formStyles";

/**
 * The only numbers needed to sell an ad slot.
 *
 * The columns were in the schema from the start but were neither written nor
 * read anywhere - so "how often was this banner shown?" had no answer. The
 * counts now come from the browser (components/ads/AdImpression.tsx) and from
 * the click redirect route (app/api/ads/[id]/click).
 *
 * CTR is computed only where there are impressions: a dash instead of a
 * division by zero, because "0%" gives the wrong impression - it is not a bad
 * result, there is simply no measurement yet.
 */
function formatCount(n: number) {
  return n.toLocaleString("az-AZ");
}

function ctr(impressions: number, clicks: number) {
  if (impressions === 0) return "—";
  return `${((clicks / impressions) * 100).toFixed(2)}%`;
}

export default async function AdminAdsPage() {
  const ads = await prisma.adBanner.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Reklamlar</h1>
        <Link href="/admin/ads/new" className={primaryButtonClass}>
          + Yeni reklam
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-border-subtle">
        {ads.map((ad) => (
          <Link
            key={ad.id}
            href={`/admin/ads/${ad.id}`}
            className="flex items-center gap-3 border-b border-border-subtle bg-surface px-4 py-3 last:border-b-0 hover:bg-surface-raised"
          >
            <Image
              src={ad.imageUrl}
              alt={ad.altText ?? ad.name}
              width={64}
              height={32}
              unoptimized
              className="h-8 w-16 rounded object-cover"
            />
            <span className="flex-1 font-medium">{ad.name}</span>
            <span className="hidden text-xs tabular-nums text-foreground-muted sm:inline">
              {formatCount(ad.impressions)} göstərilmə
            </span>
            <span className="hidden text-xs tabular-nums text-foreground-muted sm:inline">
              {formatCount(ad.clicks)} klik
            </span>
            <span className="w-14 text-right text-xs tabular-nums text-foreground-muted">
              {ctr(ad.impressions, ad.clicks)}
            </span>
            <span className="text-xs text-foreground-muted">{ad.placement}</span>
            {ad.isActive ? (
              <span className="text-xs text-foreground-muted">aktiv</span>
            ) : (
              <span className="text-xs text-live">deaktiv</span>
            )}
          </Link>
        ))}
        {ads.length === 0 && <p className="p-6 text-center text-sm text-foreground-muted">Reklam yoxdur.</p>}
      </div>
    </div>
  );
}
