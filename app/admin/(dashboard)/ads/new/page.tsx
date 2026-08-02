import AdForm from "@/components/admin/AdForm";
import { createAd } from "../actions";

export default function NewAdPage() {
  return (
    <div>
      <h1 className="font-display mb-6 text-2xl font-bold">Yeni reklam</h1>
      <AdForm action={createAd} />
    </div>
  );
}
