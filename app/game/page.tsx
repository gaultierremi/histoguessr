import { getSessionQuestions } from "@/lib/questions";
import GameCard from "@/components/GameCard";

export const dynamic = "force-dynamic";

export default async function GamePage() {
  try {
    const questions = await getSessionQuestions();
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <GameCard questions={questions} />
      </main>
    );
  } catch {
    return (
      <main className="min-h-screen bg-gray-950 flex justify-center p-2">
        <p className="text-gray-500 text-center">
          Aucune question disponible pour le moment.
          <br />
          <span className="text-sm">Ajoute au moins 5 entrées dans la table questions.</span>
        </p>
      </main>
    );
  }
}
