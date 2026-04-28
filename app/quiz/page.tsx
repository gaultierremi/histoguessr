import Link from "next/link";
import { getQuizQuestions } from "@/lib/quiz";
import QuizCard from "@/components/QuizCard";
import Header from "@/components/Header";
import type { QuizDifficulty } from "@/lib/types";

export const dynamic = "force-dynamic";

const DIFF_CONFIG = [
  {
    value: 1 as QuizDifficulty,
    label: "Débutant",
    description: "L'histoire en questions accessibles",
    stars: 1,
    starColor: "text-green-400",
    cardBorder: "border-gray-800 hover:border-green-700/60",
  },
  {
    value: 2 as QuizDifficulty,
    label: "Pro",
    description: "Pour les passionnés d'Histoire",
    stars: 2,
    starColor: "text-amber-400",
    cardBorder: "border-gray-800 hover:border-amber-700/60",
  },
  {
    value: 3 as QuizDifficulty,
    label: "Expert",
    description: "Pour les vrais historiens",
    stars: 3,
    starColor: "text-red-400",
    cardBorder: "border-gray-800 hover:border-red-700/60",
  },
] as const;

function DifficultySelect() {
  return (
    <main className="flex min-h-screen flex-col bg-gray-950">
      <Header />
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
      <div className="flex w-full max-w-md flex-col items-center gap-8">
        <div className="text-center">
          <span className="mb-4 inline-block rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-amber-400">
            Mode Quiz
          </span>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-white">
            Choisis ton niveau
          </h1>
          <p className="mt-2 text-gray-400">10 questions pour tester tes connaissances</p>
        </div>

        <div className="flex w-full flex-col gap-3">
          {DIFF_CONFIG.map((d) => (
            <Link
              key={d.value}
              href={`/quiz?difficulty=${d.value}`}
              className={`group flex items-center gap-5 rounded-2xl border bg-gray-900 p-5 transition-all ${d.cardBorder}`}
            >
              <span className={`shrink-0 text-xl tracking-widest ${d.starColor}`}>
                {"★".repeat(d.stars)}
                <span className="text-gray-700">{"★".repeat(3 - d.stars)}</span>
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-lg font-bold text-white">{d.label}</p>
                <p className="mt-0.5 text-sm text-gray-500">{d.description}</p>
              </div>
              <svg
                className="shrink-0 text-gray-600 transition-colors group-hover:text-gray-400"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </Link>
          ))}
        </div>

        <Link href="/" className="text-sm text-gray-600 transition-colors hover:text-gray-400">
          ← Retour à l&apos;accueil
        </Link>
      </div>
      </div>
    </main>
  );
}

export default async function QuizPage({
  searchParams,
}: {
  searchParams: { difficulty?: string };
}) {
  const raw = Number(searchParams.difficulty);
  const difficulty = (raw === 1 || raw === 2 || raw === 3 ? raw : null) as QuizDifficulty | null;

  if (difficulty === null) {
    return <DifficultySelect />;
  }

  try {
    const questions = await getQuizQuestions(difficulty);
    return (
      <main className="flex min-h-screen flex-col bg-gray-950">
        <Header />
        <div className="flex-1 px-4">
          <QuizCard questions={questions} difficulty={difficulty} />
        </div>
      </main>
    );
  } catch {
    return (
      <main className="flex min-h-screen flex-col bg-gray-950">
        <Header />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
          <p className="text-center text-gray-400">
            Pas assez de questions disponibles pour ce niveau.
            <br />
            <span className="text-sm text-gray-600">Revenez plus tard !</span>
          </p>
          <Link
            href="/quiz"
            className="rounded-full bg-amber-500 px-6 py-2 text-sm font-bold text-gray-950 hover:bg-amber-400"
          >
            ← Choisir un autre niveau
          </Link>
        </div>
      </main>
    );
  }
}
