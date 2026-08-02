import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export type SearchResult = {
  type: "team" | "player" | "news" | "tournament";
  label: string;
  sublabel: string;
  href: string;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  const locale = searchParams.get("locale") === "en" ? "en" : "az";

  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const [teams, players, tournaments, articles] = await Promise.all([
    prisma.team.findMany({
      where: { name: { contains: q, mode: "insensitive" } },
      include: { game: true },
      take: 5,
    }),
    prisma.player.findMany({
      where: { nickname: { contains: q, mode: "insensitive" } },
      include: { game: true },
      take: 5,
    }),
    prisma.tournament.findMany({
      where: { name: { contains: q, mode: "insensitive" } },
      include: { game: true },
      take: 5,
    }),
    prisma.newsArticleTranslation.findMany({
      where: { locale, title: { contains: q, mode: "insensitive" } },
      include: { article: { include: { game: true } } },
      take: 5,
    }),
  ]);

  const results: SearchResult[] = [
    ...teams.map((t) => ({
      type: "team" as const,
      label: t.name,
      sublabel: t.game.name,
      href: `/${locale}/teams/${t.slug}`,
    })),
    ...players.map((p) => ({
      type: "player" as const,
      label: p.nickname,
      sublabel: p.game.name,
      href: `/${locale}/players/${p.slug}`,
    })),
    ...tournaments.map((e) => ({
      type: "tournament" as const,
      label: e.name,
      sublabel: e.game.name,
      href: `/${locale}/events/${e.slug}`,
    })),
    ...articles.map((a) => ({
      type: "news" as const,
      label: a.title,
      sublabel: a.article.game?.name ?? (locale === "az" ? "Ümumi" : "General"),
      href: `/${locale}/news/${a.article.slug}`,
    })),
  ];

  return NextResponse.json({ results });
}
