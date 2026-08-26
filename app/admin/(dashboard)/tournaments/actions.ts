"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireSuperAdmin } from "@/lib/adminAuth";
import type { AdminSaveState } from "@/lib/adminFormState";
import type { TournamentTier, TournamentStatus } from "@/app/generated/prisma/client";


function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function tournamentData(formData: FormData) {
  const name = String(formData.get("name") ?? "");
  return {
    name,
    slug: slugify(String(formData.get("slug") || name)),
    gameId: String(formData.get("gameId") ?? ""),
    logoUrl: String(formData.get("logoUrl") ?? "") || null,
    tier: String(formData.get("tier") ?? "B") as TournamentTier,
    startDate: new Date(String(formData.get("startDate") ?? "")),
    endDate: new Date(String(formData.get("endDate") ?? "")),
    location: String(formData.get("location") ?? "") || null,
    prizePool: String(formData.get("prizePool") ?? "") || null,
    format: String(formData.get("format") ?? "") || null,
    status: String(formData.get("status") ?? "UPCOMING") as TournamentStatus,
  };
}

export async function createTournament(formData: FormData) {
  await requireAdmin();
  await prisma.tournament.create({ data: tournamentData(formData) });
  revalidatePath("/admin/tournaments");
  revalidatePath("/[locale]", "layout");
  redirect("/admin/tournaments");
}

export async function updateTournament(id: string, formData: FormData) {
  await requireAdmin();
  await prisma.tournament.update({ where: { id }, data: tournamentData(formData) });
  revalidatePath("/admin/tournaments");
  revalidatePath("/[locale]", "layout");
  redirect("/admin/tournaments");
}

export async function deleteTournament(id: string) {
  await requireSuperAdmin();
  await prisma.tournament.delete({ where: { id } });
  revalidatePath("/admin/tournaments");
  revalidatePath("/[locale]", "layout");
  redirect("/admin/tournaments");
}

export async function addParticipant(tournamentId: string, formData: FormData) {
  await requireAdmin();
  const teamId = String(formData.get("teamId") ?? "");
  if (!teamId) throw new Error("Komanda seçilməyib");
  const seed = formData.get("seed") ? Number(formData.get("seed")) : null;
  await prisma.tournamentParticipant.create({ data: { tournamentId, teamId, seed } });
  revalidatePath(`/admin/tournaments/${tournamentId}`);
  revalidatePath("/[locale]", "layout");
}

/** Placement decides which prize range a team falls into on the public page. */
export async function setParticipantPlacement(
  tournamentId: string,
  participantId: string,
  _prev: AdminSaveState,
  formData: FormData,
): Promise<AdminSaveState> {
  await requireAdmin();
  const raw = String(formData.get("placement") ?? "").trim();
  if (raw !== "" && !Number.isFinite(Number(raw))) {
    return { error: "Yer rəqəm olmalıdır" };
  }
  await prisma.tournamentParticipant.update({
    where: { id: participantId },
    data: { placement: raw === "" ? null : Number(raw) },
  });
  revalidatePath(`/admin/tournaments/${tournamentId}`);
  revalidatePath("/[locale]", "layout");
  return { ok: true };
}

export async function addPrize(tournamentId: string, formData: FormData) {
  await requireAdmin();
  const placeFrom = Number(formData.get("placeFrom"));
  const placeTo = Number(formData.get("placeTo"));
  const amount = Number(formData.get("amount"));
  if (!placeFrom || !placeTo || placeTo < placeFrom) {
    throw new Error("Yer aralığı düzgün deyil");
  }

  await prisma.tournamentPrize.upsert({
    where: { tournamentId_placeFrom: { tournamentId, placeFrom } },
    create: { tournamentId, placeFrom, placeTo, amount, label: String(formData.get("label") ?? "") || null },
    update: { placeTo, amount, label: String(formData.get("label") ?? "") || null },
  });

  revalidatePath(`/admin/tournaments/${tournamentId}`);
  revalidatePath("/[locale]", "layout");
}

export async function removePrize(tournamentId: string, prizeId: string) {
  await requireAdmin();
  await prisma.tournamentPrize.delete({ where: { id: prizeId } });
  revalidatePath(`/admin/tournaments/${tournamentId}`);
  revalidatePath("/[locale]", "layout");
}

export async function removeParticipant(tournamentId: string, participantId: string) {
  await requireAdmin();
  await prisma.tournamentParticipant.delete({ where: { id: participantId } });
  revalidatePath(`/admin/tournaments/${tournamentId}`);
  revalidatePath("/[locale]", "layout");
}
