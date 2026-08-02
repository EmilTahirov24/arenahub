"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";

async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) throw new Error("Unauthorized");
  return session;
}

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function newsData(formData: FormData) {
  const tagsRaw = String(formData.get("tags") ?? "");
  const tags = tagsRaw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  return {
    gameId: String(formData.get("gameId") ?? "") || null,
    relatedTeamId: String(formData.get("relatedTeamId") ?? "") || null,
    coverImageUrl: String(formData.get("coverImageUrl") ?? "") || null,
    tags,
    isFeatured: formData.get("isFeatured") === "on",
  };
}

function translationData(formData: FormData, locale: "az" | "en") {
  return {
    title: String(formData.get(`title_${locale}`) ?? ""),
    excerpt: String(formData.get(`excerpt_${locale}`) ?? "") || null,
    bodyHtml: String(formData.get(`bodyHtml_${locale}`) ?? ""),
  };
}

export async function createNews(formData: FormData) {
  const session = await requireAdmin();
  const isPublished = formData.get("isPublished") === "on";
  const azTitle = String(formData.get("title_az") ?? "");
  const enTitle = String(formData.get("title_en") ?? "");
  const slug = slugify(azTitle || enTitle || "xeber") + "-" + Math.random().toString(36).slice(2, 6);

  const article = await prisma.newsArticle.create({
    data: {
      ...newsData(formData),
      slug,
      authorId: session.id,
      publishedAt: isPublished ? new Date() : null,
    },
  });

  await prisma.newsArticleTranslation.createMany({
    data: [
      { articleId: article.id, locale: "az", ...translationData(formData, "az") },
      { articleId: article.id, locale: "en", ...translationData(formData, "en") },
    ],
  });

  revalidatePath("/admin/news");
  revalidatePath("/[locale]", "layout");
  redirect("/admin/news");
}

export async function updateNews(id: string, formData: FormData) {
  await requireAdmin();
  const existing = await prisma.newsArticle.findUnique({ where: { id } });
  if (!existing) throw new Error("Not found");

  const isPublished = formData.get("isPublished") === "on";

  await prisma.newsArticle.update({
    where: { id },
    data: {
      ...newsData(formData),
      publishedAt: isPublished ? (existing.publishedAt ?? new Date()) : null,
    },
  });

  for (const locale of ["az", "en"] as const) {
    await prisma.newsArticleTranslation.upsert({
      where: { articleId_locale: { articleId: id, locale } },
      create: { articleId: id, locale, ...translationData(formData, locale) },
      update: translationData(formData, locale),
    });
  }

  revalidatePath("/admin/news");
  revalidatePath("/[locale]", "layout");
  redirect("/admin/news");
}

export async function deleteNews(id: string) {
  await requireAdmin();
  await prisma.newsArticle.delete({ where: { id } });
  revalidatePath("/admin/news");
  revalidatePath("/[locale]", "layout");
  redirect("/admin/news");
}
