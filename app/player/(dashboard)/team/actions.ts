"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getPlayerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export async function createTeam(formData: FormData) {
  const session = await getPlayerSession();
  // Bitmiş sessiya adi haldır — xəta ekranı yox, giriş səhifəsi (AGENTS.md).
  if (!session) redirect("/player/login");

  const existing = await prisma.team.findFirst({ where: { ownerId: session.id } });
  if (existing) throw new Error("Artıq komandanız var");

  // Founding a team also puts you on its roster, so someone already playing for
  // another team would end up on two at once — they have to leave first.
  const membership = await prisma.teamMembership.findFirst({ where: { playerId: session.id, leftAt: null } });
  if (membership) throw new Error("Artıq bir komandanın tərkibindəsiniz — əvvəlcə oradan ayrılın");

  const name = String(formData.get("name") ?? "").trim();
  const gameId = String(formData.get("gameId") ?? "");
  if (!name || !gameId) return;

  const team = await prisma.team.create({
    data: {
      name,
      slug: `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`,
      gameId,
      country: String(formData.get("country") ?? "") || null,
      ownerId: session.id,
    },
  });

  const player = await prisma.player.findUniqueOrThrow({ where: { id: session.id } });
  await prisma.teamMembership.create({ data: { teamId: team.id, playerId: player.id } });

  revalidatePath("/player/team");
  revalidatePath("/[locale]", "layout");
  redirect("/player/team");
}

export type SaveTeamState = { ok?: true; error?: string };

/**
 * Returns a state rather than nothing.
 *
 * This was a bare action: it saved, revalidated, and left the screen exactly as
 * it was — no message, no navigation, same values in the same boxes. The owner
 * pressed "Yadda saxla" and had no way to tell whether anything had happened.
 * Same fault, and same fix, as the profile form in app/player/(dashboard).
 */
export async function updateOwnTeam(
  _prevState: SaveTeamState | undefined,
  formData: FormData,
): Promise<SaveTeamState> {
  const session = await getPlayerSession();
  // Reachable by anyone whose session simply expired, so it gets a sentence
  // rather than a thrown error and the framework's error page.
  if (!session) return { error: "Sessiyanız bitib. Yenidən daxil olun." };

  const team = await prisma.team.findFirst({ where: { ownerId: session.id } });
  if (!team) return { error: "Sahibi olduğunuz komanda tapılmadı." };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Komanda adı boş ola bilməz." };

  try {
    await prisma.team.update({
      where: { id: team.id },
      data: {
        name,
        country: String(formData.get("country") ?? "") || null,
        primaryColor: String(formData.get("primaryColor") ?? "") || null,
        secondaryColor: String(formData.get("secondaryColor") ?? "") || null,
        logoUrl: String(formData.get("logoUrl") ?? "") || null,
        description: String(formData.get("description") ?? "") || null,
      },
    });
  } catch (e) {
    console.error("Team save failed:", e);
    return { error: "Yadda saxlamaq alınmadı. Bir azdan yenidən yoxlayın." };
  }

  revalidatePath("/player/team");
  revalidatePath("/[locale]", "layout");
  return { ok: true };
}
