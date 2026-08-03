/**
 * Absolute base URL of the site, used for links that leave the app: password
 * reset and email verification links, sitemap entries, robots.txt.
 *
 * Read through this helper rather than `process.env.NEXT_PUBLIC_SITE_URL`
 * directly — string-interpolating a missing env var produced links that began
 * with the literal text "undefined", which is invisible until a real user gets
 * a broken reset email. On Vercel we can fall back to the deployment URL the
 * platform injects; locally we fall back to the dev server.
 */
export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;

  return "http://localhost:3000";
}
