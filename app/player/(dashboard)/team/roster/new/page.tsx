import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPlayerSession } from "@/lib/auth";
import InvitePlayerSearch from "@/components/team/InvitePlayerSearch";
import OwnPlayerForm from "@/components/team/OwnPlayerForm";
import { createOwnPlayer } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewOwnPlayerPage() {
  const session = await getPlayerSession();
  if (!session) redirect("/player/login");

  // Both forms below are useless without a team to add to — send the player to
  // the page that lets them found one instead of failing on submit.
  const team = await prisma.team.findFirst({ where: { ownerId: session.id }, select: { id: true } });
  if (!team) redirect("/player/team");

  return (
    <div className="max-w-lg">
      <h1 className="font-display mb-6 text-2xl font-bold">Tərkibə oyunçu əlavə et</h1>

      <InvitePlayerSearch />

      <div className="my-8 flex items-center gap-3 text-xs uppercase tracking-wide text-foreground-muted">
        <span className="h-px flex-1 bg-border-subtle" />
        və ya
        <span className="h-px flex-1 bg-border-subtle" />
      </div>

      <h2 className="font-display mb-1 text-lg font-bold">Hesabı olmayan oyunçu əlavə et</h2>
      <p className="mb-4 text-sm text-foreground-muted">
        Oyunçunun ArenaHub hesabı yoxdursa, profilini siz yaradın. Adı düzgün yazın — sonradan hesab açsa, profili öz
        üzərinə keçirməsi asan olsun.
      </p>
      <OwnPlayerForm action={createOwnPlayer} />
    </div>
  );
}
