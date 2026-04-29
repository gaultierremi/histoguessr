import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import Header from "@/components/Header";
import Avatar, { getLevelInfo } from "@/components/Avatar";
import AuthButton from "@/components/AuthButton";
import DailyChallengeCard from "@/components/DailyChallengeCard";
import { getOrCreateProfile } from "@/lib/profile";
import { getQuizLeaderboard } from "@/lib/scores";
import type { UserStats } from "@/lib/profile";

export const dynamic = "force-dynamic";

const SECONDARY_MODES = [
  { href: "/quiz",  emoji: "📝", label: "Quiz",          desc: "Questions d'histoire" },
  { href: "/game",  emoji: "🔍", label: "Anachronisme",  desc: "Trouve l'intrus dans l'image" },
  { href: "/duel",  emoji: "⚔️", label: "Multi-joueurs", desc: "Affronte un ami en direct" },
  { href: null,     emoji: "🔮", label: "Bientôt…",      desc: "Nouveau mode en préparation" },
];

function LevelBadge({ totalGames }: { totalGames: number }) {
  const { color, label } = getLevelInfo(totalGames);
  return (
    <span
      className="mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ background: `${color}25`, color }}
    >
      {label}
    </span>
  );
}

function StatRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-gray-800/50 px-3 py-2">
      <span className="text-xs text-gray-500">
        {icon} {label}
      </span>
      <span className="text-xs font-semibold text-gray-200">{value}</span>
    </div>
  );
}

export default async function Home() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const today = new Date().toISOString().slice(0, 10);

  let userStats: UserStats | null = null;
  let dailyProps = {
    isLoggedIn: false,
    played:     false,
    score:      undefined as number | undefined,
    maxScore:   undefined as number | undefined,
    rank:       undefined as number | undefined,
    streak:     0,
  };

  if (user) {
    const userName =
      (user.user_metadata?.full_name as string | undefined) ??
      (user.user_metadata?.name as string | undefined) ??
      user.email?.split("@")[0] ??
      "Joueur";

    const profile = await getOrCreateProfile(supabase, user.id, userName);

    const [
      { count: quizGames },
      { count: dailyGames },
      quizBestR,
      leaderboard,
      challengeR,
    ] = await Promise.all([
      supabase
        .from("quiz_scores")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
      supabase
        .from("daily_scores")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
      supabase
        .from("quiz_scores")
        .select("score")
        .eq("user_id", user.id)
        .order("score", { ascending: false })
        .limit(1),
      getQuizLeaderboard(supabase),
      supabase
        .from("daily_challenges")
        .select("id")
        .eq("date", today)
        .maybeSingle(),
    ]);

    const total_games = (quizGames ?? 0) + (dailyGames ?? 0);
    const best_score =
      (quizBestR.data?.[0] as { score: number } | undefined)?.score ?? 0;
    const rankIdx = leaderboard.findIndex((e) => e.user_id === user.id);
    const global_rank = rankIdx >= 0 ? rankIdx + 1 : null;
    const favorite_mode =
      (dailyGames ?? 0) >= (quizGames ?? 0)
        ? "Ligne du temps"
        : (quizGames ?? 0) > 0
        ? "Quiz"
        : null;

    userStats = { ...profile, total_games, best_score, global_rank, favorite_mode };
    dailyProps.isLoggedIn = true;
    dailyProps.streak     = profile.streak;

    if (challengeR.data) {
      const cid = (challengeR.data as { id: string }).id;
      const { data: myScore } = await supabase
        .from("daily_scores")
        .select("score, max_score")
        .eq("user_id", user.id)
        .eq("challenge_id", cid)
        .maybeSingle();

      if (myScore) {
        const s = myScore as { score: number; max_score: number };
        const { count } = await supabase
          .from("daily_scores")
          .select("id", { count: "exact", head: true })
          .eq("challenge_id", cid)
          .gt("score", s.score);

        dailyProps.played   = true;
        dailyProps.score    = s.score;
        dailyProps.maxScore = s.max_score;
        dailyProps.rank     = (count ?? 0) + 1;
      }
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-950">
      <Header />

      {/* Subtle ambient glow */}
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 flex justify-center">
        <div
          className="mt-16 h-72 w-96 rounded-full opacity-[0.05] blur-3xl"
          style={{ background: "radial-gradient(circle, #f59e0b, transparent 70%)" }}
        />
      </div>

      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 md:flex-row md:items-start md:gap-8 md:px-6 md:py-10">

        {/* ── Left sidebar ── */}
        <aside className="w-full shrink-0 md:w-[35%]">
          {userStats ? (
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-gray-800 bg-gray-900 p-6 text-center">
              <Avatar profile={userStats} totalGames={userStats.total_games} size="lg" />

              <div>
                <p className="text-lg font-bold text-white">{userStats.user_name}</p>
                <LevelBadge totalGames={userStats.total_games} />
              </div>

              <div className="w-full space-y-1.5">
                <StatRow icon="🎮" label="Parties"       value={String(userStats.total_games)} />
                <StatRow icon="🔥" label="Streak"        value={`${userStats.streak} jour${userStats.streak !== 1 ? "s" : ""}`} />
                {userStats.global_rank !== null && (
                  <StatRow icon="🏆" label="Rang global"  value={`#${userStats.global_rank}`} />
                )}
                {userStats.best_score > 0 && (
                  <StatRow icon="⭐" label="Meilleur score" value={`${userStats.best_score} pts`} />
                )}
              </div>

              {userStats.favorite_mode && (
                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-400">
                  {userStats.favorite_mode}
                </span>
              )}

              <button
                disabled
                className="mt-1 w-full cursor-not-allowed rounded-xl border border-gray-800 py-2 text-sm text-gray-700"
              >
                Modifier mon profil
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-5 rounded-2xl border border-gray-800 bg-gray-900 p-6 text-center">
              <span className="text-5xl">🏛️</span>
              <div>
                <p className="font-bold text-white">Rejoins HistoGuess</p>
                <p className="mt-1 text-sm text-gray-500">
                  Sauvegarde tes scores et débloque des skins historiques
                </p>
              </div>
              <AuthButton />
            </div>
          )}
        </aside>

        {/* ── Right column ── */}
        <div className="flex flex-1 flex-col gap-4">

          {/* Daily challenge banner */}
          <DailyChallengeCard {...dailyProps} variant="banner" />

          {/* Featured mode — Ligne du temps */}
          <div className="flex flex-col gap-2">
            <p className="text-xs uppercase tracking-widest text-gray-600">Modes de jeu</p>
            <Link
              href="/timeline"
              className="group relative flex min-h-[160px] flex-col justify-between rounded-2xl border border-amber-500/50 bg-gray-900 p-5 transition-all hover:border-amber-500/80 hover:bg-gray-800/80 active:scale-[0.98]"
            >
              {/* Badge */}
              <span className="absolute right-4 top-4 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-400">
                🎯 Jeu principal
              </span>

              <div className="flex flex-col gap-2">
                <span className="text-4xl leading-none">📅</span>
                <div>
                  <p className="text-lg font-black text-white">Ligne du temps</p>
                  <p className="mt-1 text-sm text-gray-400">
                    Replace des événements historiques dans l&apos;ordre chronologique — du plus simple au plus expert.
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <span className="rounded-xl bg-amber-500 px-5 py-2 text-sm font-bold text-gray-950 transition-colors group-hover:bg-amber-400">
                  Jouer →
                </span>
              </div>
            </Link>
          </div>

          {/* 2×2 secondary modes grid */}
          <div className="grid grid-cols-2 gap-2">
            {SECONDARY_MODES.map((m) =>
              m.href ? (
                <Link
                  key={m.href}
                  href={m.href}
                  className="group flex flex-col gap-1 rounded-xl border border-gray-800 bg-gray-900 p-4 transition-all hover:border-gray-700 hover:bg-gray-800/80 active:scale-[0.97]"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base leading-none">{m.emoji}</span>
                    <span className="text-sm font-bold text-white">{m.label}</span>
                  </div>
                  <p className="text-xs text-gray-600">{m.desc}</p>
                </Link>
              ) : (
                <div
                  key={m.label}
                  className="flex flex-col gap-1 rounded-xl border border-dashed border-gray-800 bg-gray-900/50 p-4 opacity-50"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base leading-none">{m.emoji}</span>
                    <span className="text-sm font-bold text-gray-500">{m.label}</span>
                  </div>
                  <p className="text-xs text-gray-700">{m.desc}</p>
                </div>
              )
            )}
          </div>

          {/* Scoreboard card */}
          <Link
            href="/scoreboard"
            className="group flex items-center gap-4 rounded-xl border border-gray-800 bg-gray-900 p-4 transition-all hover:border-gray-700 hover:bg-gray-800/80 active:scale-[0.97]"
          >
            <span className="text-2xl leading-none">🏆</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-white">Classement</p>
              <p className="text-xs text-gray-600">Voir les meilleurs joueurs</p>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-gray-700 transition-transform group-hover:translate-x-0.5">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </Link>
        </div>
      </main>
    </div>
  );
}
