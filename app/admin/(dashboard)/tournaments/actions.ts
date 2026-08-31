"use server";

import { revalidatePublicContent } from "@/lib/cacheTags";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireSuperAdmin } from "@/lib/adminAuth";
import type { AdminSaveState } from "@/lib/adminFormState";
import { placeRangeLabel } from "@/lib/prizes";
import type { TournamentTier, TournamentStatus } from "@/app/generated/prisma/client";


function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/** Prisma-nın «bu dəyər artıq var» xətası. */
function isDuplicate(e: unknown): boolean {
  return typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "P2002";
}

/**
 * Turnirin sahələrini oxuyur və insanın oxuya biləcəyi səhvi qaytarır.
 *
 * Ölçüldü: bitmə tarixi başlama tarixindən ƏVVƏL yazılanda forma onu sakitcə
 * qəbul edirdi (20 sentyabr → 1 sentyabr) və public səhifədə mənasız aralıq
 * görünürdü. Tarix sahələri brauzerdə «required»-dır, amma bir-birinə görə
 * yoxlanmırdı.
 */
function readTournament(formData: FormData): { data: ReturnType<typeof tournamentData> } | { error: string } {
  const data = tournamentData(formData);
  if (!data.name.trim()) return { error: "Ad boş ola bilməz" };
  if (!data.gameId) return { error: "Oyun seçilməyib" };
  if (!data.slug) return { error: "Slug hərf və ya rəqəm saxlamalıdır" };
  if (Number.isNaN(data.startDate.getTime())) return { error: "Başlama tarixi düzgün deyil" };
  if (Number.isNaN(data.endDate.getTime())) return { error: "Bitmə tarixi düzgün deyil" };
  if (data.endDate < data.startDate) return { error: "Bitmə tarixi başlama tarixindən əvvəl ola bilməz" };
  return { data };
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

export async function createTournament(_prev: AdminSaveState, formData: FormData): Promise<AdminSaveState> {
  await requireAdmin();
  const read = readTournament(formData);
  if ("error" in read) return { error: read.error };

  try {
    await prisma.tournament.create({ data: read.data });
  } catch (e) {
    // Slug unikaldır. Əvvəl bu, ümumi «əməliyyat tamamlanmadı» ekranına
    // düşürdü və orada «çox güman sessiyanız bitib» yazılırdı — səbəb isə
    // tamam başqa idi: eyni adlı turnir artıq var.
    if (isDuplicate(e)) return { error: `«${read.data.slug}» slug-ı artıq işlənir — adı və ya slug-ı dəyişin` };
    throw e;
  }

  revalidatePath("/admin/tournaments");
  revalidatePublicContent();
  redirect("/admin/tournaments");
}

export async function updateTournament(
  id: string,
  _prev: AdminSaveState,
  formData: FormData,
): Promise<AdminSaveState> {
  await requireAdmin();
  const read = readTournament(formData);
  if ("error" in read) return { error: read.error };

  try {
    await prisma.tournament.update({ where: { id }, data: read.data });
  } catch (e) {
    if (isDuplicate(e)) return { error: `«${read.data.slug}» slug-ı başqa turnirdədir — adı və ya slug-ı dəyişin` };
    throw e;
  }

  revalidatePath("/admin/tournaments");
  revalidatePublicContent();
  redirect("/admin/tournaments");
}

export async function deleteTournament(id: string) {
  await requireSuperAdmin();
  await prisma.tournament.delete({ where: { id } });
  revalidatePath("/admin/tournaments");
  revalidatePublicContent();
  redirect("/admin/tournaments");
}

export async function addParticipant(
  tournamentId: string,
  _prev: AdminSaveState,
  formData: FormData,
): Promise<AdminSaveState> {
  await requireAdmin();
  const teamId = String(formData.get("teamId") ?? "");
  if (!teamId) return { error: "Komanda seçilməyib" };

  const seedRaw = String(formData.get("seed") ?? "").trim();
  if (seedRaw !== "" && !Number.isFinite(Number(seedRaw))) return { error: "Seed rəqəm olmalıdır" };
  if (seedRaw !== "" && Number(seedRaw) < 1) return { error: "Seed 1-dən kiçik ola bilməz" };

  try {
    await prisma.tournamentParticipant.create({
      data: { tournamentId, teamId, seed: seedRaw === "" ? null : Number(seedRaw) },
    });
  } catch (e) {
    // Siyahı əlavə olunmuş komandaları göstərmir, amma iki tab açıq olanda
    // köhnə siyahı hələ də onları təklif edir.
    if (isDuplicate(e)) return { error: "Bu komanda artıq turnirdədir" };
    throw e;
  }

  revalidatePath(`/admin/tournaments/${tournamentId}`);
  revalidatePublicContent();
  return { ok: true };
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
  revalidatePublicContent();
  return { ok: true };
}

export async function addPrize(
  tournamentId: string,
  _prev: AdminSaveState,
  formData: FormData,
): Promise<AdminSaveState> {
  await requireAdmin();

  const placeFrom = Number(String(formData.get("placeFrom") ?? "").trim());
  // Boş «Yerə» = tək yer. Mükafatların çoxu tək yerədir (1-ci, 2-ci, 3-cü) və
  // eyni rəqəmi iki dəfə yazdırmaq forma ilə mübarizəyə çevrilirdi.
  const placeToRaw = String(formData.get("placeTo") ?? "").trim();
  const placeTo = placeToRaw === "" ? placeFrom : Number(placeToRaw);
  const amount = Number(String(formData.get("amount") ?? "").trim());

  // Səhvlər ayrı-ayrı yazılır. Əvvəl hamısı bir «Yer aralığı düzgün deyil»
  // sətri idi və o da ekrana çatmırdı: throw ümumi səhv sərhəddinə düşürdü,
  // istifadəçi isə «çox güman sessiyanız bitib» oxuyurdu.
  if (!Number.isInteger(placeFrom) || placeFrom < 1) return { error: "«Yerdən» 1 və ya daha böyük tam ədəd olmalıdır" };
  if (!Number.isInteger(placeTo) || placeTo < 1) return { error: "«Yerə» 1 və ya daha böyük tam ədəd olmalıdır" };
  if (placeTo < placeFrom) return { error: `«Yerə» «Yerdən»dən kiçik ola bilməz (${placeFrom} → ${placeTo})` };
  if (!Number.isFinite(amount) || amount < 0) return { error: "Məbləğ mənfi olmayan rəqəm olmalıdır" };

  const label = String(formData.get("label") ?? "").trim() || null;

  // Eyni «Yerdən» üçün sətir varsa, upsert onu ƏVƏZ EDİR. Ölçüldü: admin
  // «1-4-cü yerlər $20 000» yazıb sonra «1-ci yer $99 000» əlavə edəndə
  // birinci sətir heç bir xəbər olmadan yox olurdu — yeni sətir əlavə etdiyini
  // düşünürdü, əslində köhnəni silirdi. İndi nə baş verdiyi deyilir.
  const existing = await prisma.tournamentPrize.findUnique({
    where: { tournamentId_placeFrom: { tournamentId, placeFrom } },
  });

  await prisma.tournamentPrize.upsert({
    where: { tournamentId_placeFrom: { tournamentId, placeFrom } },
    create: { tournamentId, placeFrom, placeTo, amount, label },
    update: { placeTo, amount, label },
  });

  revalidatePath(`/admin/tournaments/${tournamentId}`);
  revalidatePublicContent();

  if (existing) {
    return {
      ok: true,
      note: `${placeRangeLabel(existing, "az")} sətri əvəzləndi — hər «Yerdən» üçün bir sətir olur`,
    };
  }
  return { ok: true };
}

export async function removePrize(tournamentId: string, prizeId: string) {
  await requireAdmin();
  await prisma.tournamentPrize.delete({ where: { id: prizeId } });
  revalidatePath(`/admin/tournaments/${tournamentId}`);
  revalidatePublicContent();
}

export async function removeParticipant(tournamentId: string, participantId: string) {
  await requireAdmin();
  await prisma.tournamentParticipant.delete({ where: { id: participantId } });
  revalidatePath(`/admin/tournaments/${tournamentId}`);
  revalidatePublicContent();
}
