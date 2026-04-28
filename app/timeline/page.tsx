import Link from "next/link";
import { getTimelineEvents } from "@/lib/timeline";
import TimelineGame from "@/components/TimelineGame";
import TimelineSortGame from "@/components/TimelineSortGame";
import Header from "@/components/Header";

export const dynamic = "force-dynamic";

const DIFF_CONFIG = [
  {
    value: 1,
    label: "Débutant",
    description: "Événements connus de tous",
    stars: 1,
    starColor: "text-green-400",
    cardBorder: "border-gray-800 hover:border-green-700/60",
  },
  {
    value: 2,
    label: "Pro",
    description: "Pour les passionnés d'Histoire",
    stars: 2,
    starColor: "text-amber-400",
    cardBorder: "border-gray-800 hover:border-amber-700/60",
  },
  {
    value: 3,
    label: "Expert",
    description: "Pour les vrais historiens",
    stars: 3,
    starColor: "text-red-400",
    cardBorder: "border-gray-800 hover:border-red-700/60",
  },
] as const;

function ArrowIcon() {
  return (
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
  );
}

function ModeSelect() {
  return (
    <main className="flex min-h-screen flex-col bg-gray-950">
      <Header />
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
      <div className="flex w-full max-w-md flex-col items-center gap-8">
        <div className="text-center">
          <span className="mb-4 inline-block rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-amber-400">
            Mode Frise
          </span>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-white">
            Choisis ton mode
          </h1>
          <p className="mt-2 text-gray-400">Teste ta maîtrise de la chronologie</p>
        </div>

        <div className="flex w-full flex-col gap-3">
          <Link
            href="/timeline?mode=placement"
            className="group flex flex-col gap-2 rounded-2xl border border-gray-800 bg-gray-900 p-5 transition-all hover:border-amber-700/60"
          >
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold text-white">📍 Placement</span>
              <ArrowIcon />
            </div>
            <p className="text-sm text-gray-500">
              Place chaque événement sur la frise. Plus tu es précis, plus tu marques de points.
            </p>
          </Link>

          <Link
            href="/timeline?mode=sort"
            className="group flex flex-col gap-2 rounded-2xl border border-gray-800 bg-gray-900 p-5 transition-all hover:border-amber-700/60"
          >
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold text-white">🔀 Tri</span>
              <ArrowIcon />
            </div>
            <p className="text-sm text-gray-500">
              Remets 5 événements dans le bon ordre chronologique avec les boutons ↑ ↓.
            </p>
          </Link>
        </div>

        <Link href="/" className="text-sm text-gray-600 transition-colors hover:text-gray-400">
          ← Retour à l&apos;accueil
        </Link>
      </div>
      </div>
    </main>
  );
}

function DifficultySelect({ mode }: { mode: string }) {
  const isSortMode = mode === "sort";
  return (
    <main className="flex min-h-screen flex-col bg-gray-950">
      <Header />
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
      <div className="flex w-full max-w-md flex-col items-center gap-8">
        <div className="text-center">
          <span className="mb-4 inline-block rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-amber-400">
            {isSortMode ? "🔀 Tri" : "📍 Placement"}
          </span>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-white">
            Choisis ton niveau
          </h1>
          <p className="mt-2 text-gray-400">
            {isSortMode ? "5 événements à trier" : "8 événements à placer"}
          </p>
        </div>

        <div className="flex w-full flex-col gap-3">
          {DIFF_CONFIG.map((d) => (
            <Link
              key={d.value}
              href={`/timeline?mode=${mode}&difficulty=${d.value}`}
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
              <ArrowIcon />
            </Link>
          ))}
        </div>

        <Link
          href="/timeline"
          className="text-sm text-gray-600 transition-colors hover:text-gray-400"
        >
          ← Choisir un autre mode
        </Link>
      </div>
      </div>
    </main>
  );
}

export default async function TimelinePage({
  searchParams,
}: {
  searchParams: { mode?: string; difficulty?: string };
}) {
  const { mode, difficulty: rawDiff } = searchParams;

  if (!mode || !["placement", "sort"].includes(mode)) {
    return <ModeSelect />;
  }

  const difficulty = Number(rawDiff);
  if (![1, 2, 3].includes(difficulty)) {
    return <DifficultySelect mode={mode} />;
  }

  const count = mode === "sort" ? 5 : 8;

  try {
    const events = await getTimelineEvents(difficulty, count);
    return (
      <main className="flex min-h-screen flex-col bg-gray-950">
        <Header />
        <div className="flex-1 px-4">
          {mode === "placement" ? (
            <TimelineGame events={events} difficulty={difficulty as 1 | 2 | 3} />
          ) : (
            <TimelineSortGame events={events} difficulty={difficulty as 1 | 2 | 3} />
          )}
        </div>
      </main>
    );
  } catch {
    return (
      <main className="flex min-h-screen flex-col bg-gray-950">
        <Header />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
          <p className="text-center text-gray-400">
            Pas assez d&apos;événements disponibles pour ce niveau.
            <br />
            <span className="text-sm text-gray-600">Revenez plus tard !</span>
          </p>
          <Link
            href="/timeline"
            className="rounded-full bg-amber-500 px-6 py-2 text-sm font-bold text-gray-950 hover:bg-amber-400"
          >
            ← Choisir un autre niveau
          </Link>
        </div>
      </main>
    );
  }
}
