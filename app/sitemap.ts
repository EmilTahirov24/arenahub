import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { routing } from "@/i18n/routing";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

const STATIC_PATHS = ["", "/matches", "/results", "/live", "/teams", "/players", "/news", "/events", "/stats"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [matches, teams, players, articles, tournaments] = await Promise.all([
    prisma.match.findMany({ select: { slug: true, updatedAt: true }, take: 500, orderBy: { scheduledAt: "desc" } }),
    prisma.team.findMany({ select: { slug: true, updatedAt: true }, where: { isActive: true } }),
    prisma.player.findMany({ select: { slug: true, updatedAt: true } }),
    prisma.newsArticle.findMany({ select: { slug: true, updatedAt: true }, where: { publishedAt: { not: null } } }),
    prisma.tournament.findMany({ select: { slug: true, updatedAt: true } }),
  ]);

  const entries: MetadataRoute.Sitemap = [];

  for (const locale of routing.locales) {
    for (const p of STATIC_PATHS) {
      entries.push({ url: `${SITE_URL}/${locale}${p}`, changeFrequency: "hourly" });
    }
    for (const m of matches) {
      entries.push({ url: `${SITE_URL}/${locale}/matches/${m.slug}`, lastModified: m.updatedAt, changeFrequency: "hourly" });
    }
    for (const t of teams) {
      entries.push({ url: `${SITE_URL}/${locale}/teams/${t.slug}`, lastModified: t.updatedAt, changeFrequency: "daily" });
    }
    for (const p of players) {
      entries.push({ url: `${SITE_URL}/${locale}/players/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "daily" });
    }
    for (const a of articles) {
      entries.push({ url: `${SITE_URL}/${locale}/news/${a.slug}`, lastModified: a.updatedAt, changeFrequency: "monthly" });
    }
    for (const e of tournaments) {
      entries.push({ url: `${SITE_URL}/${locale}/events/${e.slug}`, lastModified: e.updatedAt, changeFrequency: "daily" });
    }
  }

  return entries;
}
