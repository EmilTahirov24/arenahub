import GameForm from "@/components/admin/GameForm";
import { createGame } from "../actions";

export default function NewGamePage() {
  return (
    <div>
      <h1 className="font-display mb-6 text-2xl font-bold">Yeni oyun</h1>
      <GameForm action={createGame} />
    </div>
  );
}
