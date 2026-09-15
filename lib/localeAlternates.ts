import { siteUrl } from "@/lib/siteUrl";
import { routing } from "@/i18n/routing";

/**
 * A page's canonical address and its language alternates.
 *
 * Two separate problems, solved together.
 *
 * CANONICAL. The site carried no canonical tag at all, while the list pages
 * run on query parameters - `?game=cs2`, `?page=3`, `?sort=kills` - and every
 * combination is a separate address as far as a search engine is concerned.
 * The same content could be indexed in dozens of copies.
 *
 * Here the canonical always points at the path without parameters. On
 * paginated lists that is normally a choice to make carefully: page 2 usually
 * holds content that exists nowhere else, and a canonical pointing back to
 * page 1 loses it. That risk does not apply here, because every match, team,
 * player and article has its own address and all of them are in the sitemap -
 * the second page of a list carries nothing unique. Collapsing the filter and
 * page variants onto one address is therefore the right call.
 *
 * LANGUAGE ALTERNATES. The site serves the same content in two languages.
 * Without hreflang a search engine can read the `/az/...` and `/en/...` pair
 * as duplicate content and drop one of them. These tags say they are two
 * languages of one page.
 *
 * `x-default` goes to Azerbaijani: that is the site's primary audience, and
 * the English version is the second language.
 *
 * Note: query parameters are deliberately NOT passed in here. Reading them
 * would mean awaiting `searchParams` inside `generateMetadata`, which turns
 * the page's static shell dynamic and hands back everything the caching work
 * gained.
 */
export function localeAlternates(locale: string, path = "") {
  const base = siteUrl();
  const clean = path === "/" ? "" : path;

  const languages: Record<string, string> = {};
  for (const l of routing.locales) {
    languages[l] = `${base}/${l}${clean}`;
  }
  languages["x-default"] = `${base}/${routing.defaultLocale}${clean}`;

  return {
    canonical: `${base}/${locale}${clean}`,
    languages,
  };
}
