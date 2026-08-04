import AdSlot from "@/components/ads/AdSlot";
import RecentNews from "@/components/layout/sidebar/RecentNews";
import TopTransfers from "@/components/layout/sidebar/TopTransfers";
import { prisma } from "@/lib/prisma";

/**
 * Three-column shell: an ad rail, the page, and a widget rail.
 *
 * The rails are only rendered when something will actually appear in them.
 * `AdSlot`, `TopTransfers` and `RecentNews` each return null when they have no
 * data, so a rail could previously reserve its full 160px or 300px and then
 * show nothing — with ads switched off that was around 460px of empty gutter on
 * a wide screen, squeezing the reading column to roughly 900px. Deciding here
 * costs two cheap counts and gives the content the whole width back. Nothing is
 * removed: the moment an ad or an article exists, the rail returns on its own.
 */
export default async function PageShell({
  children,
  rightRail,
  showDefaultWidgets = true,
}: {
  children: React.ReactNode;
  rightRail?: React.ReactNode;
  showDefaultWidgets?: boolean;
}) {
  const [ads, transfers, articles] = await Promise.all([
    prisma.adBanner.count({ where: { isActive: true } }),
    showDefaultWidgets ? prisma.teamMembership.count({ where: { team: { isActive: true } } }) : 0,
    showDefaultWidgets ? prisma.newsArticle.count({ where: { publishedAt: { not: null } } }) : 0,
  ]);

  const hasAds = ads > 0;
  const showLeft = hasAds;
  const showRight = hasAds || rightRail !== undefined || transfers > 0 || articles > 0;

  return (
    <div className="mx-auto flex max-w-[1400px] items-start gap-4 px-4 py-6">
      {showLeft && (
        <aside className="sticky top-20 hidden w-[160px] shrink-0 xl:block">
          <AdSlot placement="SIDEBAR_LEFT" />
        </aside>
      )}

      <main className="min-w-0 flex-1">{children}</main>

      {showRight && (
        <aside className="hidden w-[300px] shrink-0 space-y-4 lg:block">
          <AdSlot placement="SIDEBAR_RIGHT_TOP" />
          {rightRail}
          {showDefaultWidgets && (
            <>
              <TopTransfers />
              <RecentNews />
            </>
          )}
          <AdSlot placement="SIDEBAR_RIGHT_BOTTOM" />
        </aside>
      )}
    </div>
  );
}
