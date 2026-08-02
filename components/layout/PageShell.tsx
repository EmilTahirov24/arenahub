import AdSlot from "@/components/ads/AdSlot";
import RecentNews from "@/components/layout/sidebar/RecentNews";
import TopTransfers from "@/components/layout/sidebar/TopTransfers";

export default function PageShell({
  children,
  rightRail,
  showDefaultWidgets = true,
}: {
  children: React.ReactNode;
  rightRail?: React.ReactNode;
  showDefaultWidgets?: boolean;
}) {
  return (
    <div className="mx-auto flex max-w-[1400px] items-start gap-4 px-4 py-6">
      <aside className="sticky top-20 hidden w-[160px] shrink-0 xl:block">
        <AdSlot placement="SIDEBAR_LEFT" />
      </aside>

      <main className="min-w-0 flex-1">{children}</main>

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
    </div>
  );
}
