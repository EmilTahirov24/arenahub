import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AdForm from "@/components/admin/AdForm";
import { updateAd, deleteAd } from "../actions";
import { dangerButtonClass } from "@/components/admin/formStyles";

export default async function EditAdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ad = await prisma.adBanner.findUnique({ where: { id } });
  if (!ad) notFound();

  const updateWithId = updateAd.bind(null, id);
  const deleteWithId = deleteAd.bind(null, id);

  return (
    <div>
      <h1 className="font-display mb-6 text-2xl font-bold">{ad.name}</h1>
      <AdForm ad={ad} action={updateWithId} />
      <form action={deleteWithId} className="mt-6">
        <button type="submit" className={dangerButtonClass}>
          Reklamı sil
        </button>
      </form>
    </div>
  );
}
