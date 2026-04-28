import { getSessionQuestions } from "@/lib/questions";
import GameCard from "@/components/GameCard";
import Header from "@/components/Header";

export const dynamic = "force-dynamic";

export default async function GamePage() {
  try {
    const questions = await getSessionQuestions();
    return (
      <main className="flex min-h-screen flex-col bg-gray-950">
        <Header />
        <div className="flex flex-1 items-center justify-center p-4">
          <GameCard questions={questions} />
        </div>
      </main>
    );
  } catch {
    return (
      <main className="flex min-h-screen flex-col bg-gray-950">
        <Header />
        <div className="flex flex-1 justify-center p-2">
          <p className="text-center text-gray-500">
            Aucune question disponible pour le moment.
            <br />
            <span className="text-sm">Ajoute au moins 5 entrées dans la table questions.</span>
          </p>
        </div>
      </main>
    );
  }
}
