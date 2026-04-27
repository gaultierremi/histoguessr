import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import {
  getQuizLeaderboard,
  getDuelLeaderboard,
  getRecentDuels,
  type QuizLeaderboardEntry,
  type DuelLeaderboardEntry,
  type RecentDuelRow,
} from "@/lib/scores";

export const dynamic = "force-dynamic";

const TABS = ["quiz", "duel", "recent"] as const;
type Tab = (typeof TABS)[number];

const TAB_LABELS: Record<Tab, string> = {
  quiz:   "Quiz",
  duel:   "Duel",
  recent: "Duels récents",
};

function Medal({ rank }: { rank: number }) {
  if (rank === 0) return <span>🥇</span>;
  if (rank === 1) return <span>🥈</span>;
  if (rank === 2) return <span>🥉</span>;
  return <span className="text-gray-500">{rank + 1}</span>;
}

function QuizTable({ rows }: { rows: QuizLeaderboardEntry[] }) {
  if (rows.length === 0) {
    return (
      <p className="px-6 py-12 text-center text-gray-500">
        Aucune partie enregistrée.
      </p>
    );
  }
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-gray-800 bg-gray-900/50 text-left text-xs uppercase tracking-wider text-gray-500">
          <th className="px-4 py-3">#</th>
          <th className="px-4 py-3">Joueur</th>
          <th className="px-4 py-3 text-right">Meilleur</th>
          <th className="px-4 py-3 text-right">Parties</th>
          <th className="px-4 py-3 text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr
            key={row.user_id}
            className="border-b border-gray-800/50 last:border-0 transition-colors hover:bg-gray-900/40"
          >
            <td className="px-4 py-3.5 text-center">
              <Medal rank={i} />
            </td>
            <td className="px-4 py-3.5 font-medium text-white">{row.user_name}</td>
            <td className="px-4 py-3.5 text-right font-bold text-amber-400">
              {row.best_score}
            </td>
            <td className="px-4 py-3.5 text-right text-gray-400">{row.games}</td>
            <td className="px-4 py-3.5 text-right text-gray-400">{row.total_score}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DuelTable({ rows }: { rows: DuelLeaderboardEntry[] }) {
  if (rows.length === 0) {
    return (
      <p className="px-6 py-12 text-center text-gray-500">
        Aucun duel enregistré.
      </p>
    );
  }
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-gray-800 bg-gray-900/50 text-left text-xs uppercase tracking-wider text-gray-500">
          <th className="px-4 py-3">#</th>
          <th className="px-4 py-3">Joueur</th>
          <th className="px-4 py-3 text-right">Victoires</th>
          <th className="px-4 py-3 text-right">Parties</th>
          <th className="px-4 py-3 text-right">% victoires</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => {
          const pct = row.games > 0 ? Math.round((row.wins / row.games) * 100) : 0;
          return (
            <tr
              key={row.user_id}
              className="border-b border-gray-800/50 last:border-0 transition-colors hover:bg-gray-900/40"
            >
              <td className="px-4 py-3.5 text-center">
                <Medal rank={i} />
              </td>
              <td className="px-4 py-3.5 font-medium text-white">{row.user_name}</td>
              <td className="px-4 py-3.5 text-right font-bold text-amber-400">
                {row.wins}
              </td>
              <td className="px-4 py-3.5 text-right text-gray-400">{row.games}</td>
              <td className="px-4 py-3.5 text-right text-gray-400">{pct}%</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function RecentList({ rows }: { rows: RecentDuelRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-2xl border border-gray-800 px-6 py-12 text-center text-gray-500">
        Aucun duel récent.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {rows.map((d) => (
        <div
          key={d.id}
          className="flex flex-col gap-3 rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-4">
            <div className="flex min-w-0 flex-col items-center">
              <span className="max-w-[100px] truncate text-sm font-bold text-white">
                {d.host_name}
              </span>
              <span className="text-2xl font-black text-amber-400">{d.host_score}</span>
            </div>
            <span className="text-xs font-semibold text-gray-600">vs</span>
            <div className="flex min-w-0 flex-col items-center">
              <span className="max-w-[100px] truncate text-sm font-bold text-white">
                {d.guest_name ?? "—"}
              </span>
              <span className="text-2xl font-black text-amber-400">{d.guest_score}</span>
            </div>
          </div>
          <div className="flex flex-row items-center justify-between gap-2 sm:flex-col sm:items-end">
            {d.winner_name ? (
              <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-400">
                🏆 {d.winner_name}
              </span>
            ) : (
              <span className="rounded-full bg-gray-800 px-3 py-1 text-xs text-gray-500">
                Égalité
              </span>
            )}
            <span className="text-xs text-gray-600">
              {new Date(d.created_at).toLocaleDateString("fr-FR")}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function ScoreboardPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const tab: Tab = TABS.includes(searchParams.tab as Tab)
    ? (searchParams.tab as Tab)
    : "quiz";

  const supabase = createClient();
  const [quizBoard, duelBoard, recentDuels] = await Promise.all([
    getQuizLeaderboard(supabase),
    getDuelLeaderboard(supabase),
    getRecentDuels(supabase),
  ]);

  return (
    <main className="min-h-screen bg-gray-950 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-8 flex items-center gap-4">
          <Link
            href="/"
            className="text-sm text-gray-600 transition-colors hover:text-gray-400"
          >
            ← Accueil
          </Link>
          <h1 className="text-3xl font-black text-white">🏆 Scoreboard</h1>
        </div>

        {/* Tab nav */}
        <div className="mb-6 flex gap-1 rounded-xl border border-gray-800 bg-gray-900 p-1">
          {TABS.map((t) => (
            <Link
              key={t}
              href={`/scoreboard?tab=${t}`}
              className={`flex-1 rounded-lg py-2 text-center text-sm font-semibold transition-all ${
                tab === t
                  ? "bg-amber-500 text-gray-950"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {TAB_LABELS[t]}
            </Link>
          ))}
        </div>

        {/* Content */}
        {tab === "quiz" && (
          <div className="overflow-hidden rounded-2xl border border-gray-800">
            <QuizTable rows={quizBoard} />
          </div>
        )}

        {tab === "duel" && (
          <div className="overflow-hidden rounded-2xl border border-gray-800">
            <DuelTable rows={duelBoard} />
          </div>
        )}

        {tab === "recent" && <RecentList rows={recentDuels} />}
      </div>
    </main>
  );
}
