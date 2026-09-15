import { connection } from "next/server";

/**
 * The admin panel is a deliberately blocking route.
 *
 * Cache Components expects every route to open instantly and reports anything
 * that cannot be prerendered as an error. Every page here either reads the
 * session or is the sign-in form - the content varies by user and there is
 * nothing a static shell could offer. Splitting it with <Suspense> is
 * pointless too: the part being waited on is the page itself. Caching matters
 * for the public site, not for this.
 *
 * This layout exists only for the config; it adds no markup. The sign-in pages
 * are client components and `instant` does not work there, so the config has
 * to sit on the parent.
 *
 * `connection()` ties the whole branch to request time. Without it Next tries
 * to prerender every page and any value that is not stable at render time -
 * the advert form's "today" default, for instance - throws.
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
