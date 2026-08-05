import Link from "next/link";

/**
 * The way out of a dashboard, in both panels.
 *
 * It began as a line of plain text under the logo and read like an
 * afterthought: no shape, no hover, nothing marking it as something you could
 * press. Everything else in these sidebars is a rounded row with a border, so
 * this is one too — the arrow slides on hover, which is the small thing that
 * makes it feel like a door rather than a caption.
 */
export default function BackToSite() {
  return (
    <Link
      href="/"
      className="group mb-5 inline-flex w-fit items-center gap-1.5 rounded-full border border-border-subtle py-1.5 pl-2 pr-3 text-xs font-medium text-foreground-muted transition-colors hover:border-brand-via/50 hover:bg-surface-raised hover:text-foreground"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-3.5 w-3.5 transition-transform duration-150 group-hover:-translate-x-0.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M19 12H5M11 18l-6-6 6-6" />
      </svg>
      Sayta qayıt
    </Link>
  );
}
