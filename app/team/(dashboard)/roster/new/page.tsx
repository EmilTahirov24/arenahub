import OwnPlayerForm from "@/components/team/OwnPlayerForm";
import { createOwnPlayer } from "../actions";

export default function NewOwnPlayerPage() {
  return (
    <div>
      <h1 className="font-display mb-6 text-2xl font-bold">Yeni oyunçu</h1>
      <OwnPlayerForm action={createOwnPlayer} />
    </div>
  );
}
