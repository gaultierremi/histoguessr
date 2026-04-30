import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import Header from "@/components/Header";
import Avatar, { getLevelInfo } from "@/components/Avatar";
import AuthButton from "@/components/AuthButton";
import DailyChallengeTicker from "@/components/DailyChallengeTicker";
import { getOrCreateProfile } from "@/lib/profile";
import { getQuizLeaderboard } from "@/lib/scores";
import type { UserStats } from "@/lib/profile";

export const dynamic = "force-dynamic";

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
    <div className="flex items-center justify-between rounded-xl bg-gray-800/50 px-3 py-2">
      <span className="text-xs text-gray-500">
        {icon} {label}
      </span>
      <span className="text-xs font-semibold text-gray-200">{value}</span>
    </div>
  );
}

function SmallModeCard({
  href,
  emoji,
  label,
  desc,
  tag,
}: {
  href: string;
  emoji: string;
  label: string;
  desc: string;
  tag?: string;
}) {
  return (
    <Link
      href={href}
      className="group relative overflow-hidden rounded-2xl border border-gray-800 bg-gray-950/70 p-4 transition-all hover:-translate-y-1 hover:border-amber-500/50 hover:bg-gray-900 active:scale-[0.98]"
    >
      <div className="absolute -right-8 -top-8 h-20 w-20 rounded-full bg-amber-500/10 blur-2xl transition group-hover:bg-amber-500/20" />

      <div className="relative flex items-start justify-between gap-3">
        <span className="text-2xl leading-none">{emoji}</span>
        {tag && (
          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-400">
            {tag}
          </span>
        )}
      </div>

      <p className="relative mt-3 text-sm font-black text-white">{label}</p>
      <p className="relative mt-1 text-xs leading-relaxed text-gray-500">{desc}</p>
      <p className="relative mt-3 text-xs font-black text-gray-600 group-hover:text-amber-400">
        Appuie pour jouer →
      </p>
    </Link>
  );
}

function LockedModeCard({
  emoji,
  label,
  desc,
  tag,
}: {
  emoji: string;
  label: string;
  desc: string;
  tag: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-dashed border-gray-800 bg-gray-950/50 p-4 opacity-75">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.08),transparent_40%)]" />

      <div className="relative flex items-start justify-between gap-3">
        <span className="text-2xl leading-none grayscale">{emoji}</span>
        <span className="rounded-full bg-gray-800 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-gray-500">
          {tag}
        </span>
      </div>

      <p className="relative mt-3 text-sm font-black text-gray-400">{label}</p>
      <p className="relative mt-1 text-xs leading-relaxed text-gray-600">{desc}</p>
      <p className="relative mt-3 text-xs font-black text-gray-700">Verrouillé</p>
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
    played: false,
    score: undefined as number | undefined,
    maxScore: undefined as number | undefined,
    rank: undefined as number | undefined,
    streak: 0,
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
      supabase.from("quiz_scores").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("daily_scores").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("quiz_scores").select("score").eq("user_id", user.id).order("score", { ascending: false }).limit(1),
      getQuizLeaderboard(supabase),
      supabase.from("daily_challenges").select("id").eq("date", today).maybeSingle(),
    ]);

    const total_games = (quizGames ?? 0) + (dailyGames ?? 0);
    const best_score = (quizBestR.data?.[0] as { score: number } | undefined)?.score ?? 0;
    const rankIdx = leaderboard.findIndex((e) => e.user_id === user.id);
    const global_rank = rankIdx >= 0 ? rankIdx + 1 : null;
    const favorite_mode =
      (dailyGames ?? 0) >= (quizGames ?? 0)
        ? "Ligne du temps"
        : (quizGames ?? 0) > 0
        ? "Quiz"
        : null;

    userStats = {
      ...profile,
      total_games,
      best_score,
      global_rank,
      favorite_mode,
    };

    dailyProps.isLoggedIn = true;
    dailyProps.streak = profile.streak;

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

        dailyProps.played = true;
        dailyProps.score = s.score;
        dailyProps.maxScore = s.max_score;
        dailyProps.rank = (count ?? 0) + 1;
      }
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-950">
      <Header />
      <DailyChallengeTicker {...dailyProps} />

      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-10 h-80 w-[36rem] -translate-x-1/2 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-orange-500/5 blur-3xl" />
        <div className="absolute left-0 top-1/3 h-80 w-80 rounded-full bg-blue-500/5 blur-3xl" />
      </div>

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 md:flex-row md:items-start md:gap-8 md:px-6 md:py-10">
        <aside className="w-full shrink-0 md:sticky md:top-6 md:w-[32%]">
          {userStats ? (
            <div className="overflow-hidden rounded-3xl border border-gray-800 bg-gray-900 shadow-2xl shadow-black/20">
              <div className="bg-gradient-to-br from-amber-500/15 via-gray-900 to-gray-900 p-6 text-center">
                <div className="flex justify-center">
                  <Avatar
                    profile={userStats}
                    totalGames={userStats.total_games}
                    size="xl"
                    animated
                  />
                </div>

                <div className="mt-4">
                  <p className="text-xl font-black text-white">{userStats.user_name}</p>
                  <LevelBadge totalGames={userStats.total_games} />
                </div>

                {userStats.favorite_mode && (
                  <span className="mt-3 inline-flex rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-400">
                    Mode favori · {userStats.favorite_mode}
                  </span>
                )}
              </div>

              <div className="space-y-2 p-5">
                <StatRow icon="🎮" label="Parties" value={String(userStats.total_games)} />
                <StatRow
                  icon="🔥"
                  label="Streak"
                  value={`${userStats.streak} jour${userStats.streak !== 1 ? "s" : ""}`}
                />
                {userStats.global_rank !== null && (
                  <StatRow icon="🏆" label="Rang global" value={`#${userStats.global_rank}`} />
                )}
                {userStats.best_score > 0 && (
                  <StatRow icon="⭐" label="Meilleur score" value={`${userStats.best_score} pts`} />
                )}

                <Link
                  href="/profile"
                  className="mt-4 block w-full rounded-2xl border border-amber-500/30 bg-amber-500/10 py-3 text-center text-sm font-black text-amber-400 transition hover:border-amber-400 hover:bg-amber-500/20"
                >
                  Modifier mon profil
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-5 rounded-3xl border border-gray-800 bg-gray-900 p-6 text-center shadow-2xl shadow-black/20">
              <span className="text-5xl">🏛️</span>
              <div>
                <p className="text-lg font-black text-white">Rejoins HistoGuess</p>
                <p className="mt-1 text-sm leading-relaxed text-gray-500">
                  Sauvegarde tes scores, débloque des skins et grimpe dans les classements.
                </p>
              </div>
              <AuthButton />
            </div>
          )}
        </aside>

        <section className="flex flex-1 flex-col gap-5">
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="group relative overflow-hidden rounded-[2rem] border border-blue-500/30 bg-gradient-to-br from-blue-500/15 via-gray-900 to-gray-950 p-6 shadow-2xl shadow-black/20 transition-all hover:-translate-y-1 hover:border-blue-400 hover:shadow-blue-500/10">
              <div className="absolute -right-14 -top-14 h-44 w-44 rounded-full bg-blue-400/10 blur-3xl transition group-hover:bg-blue-400/20" />
              <div className="absolute bottom-6 right-6 text-[9rem] leading-none opacity-[0.07] transition group-hover:scale-110">
                🧍
              </div>

              <div className="relative z-10">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-black uppercase tracking-[0.3em] text-blue-400">
                      Solo
                    </p>
                    <h2 className="mt-2 text-4xl font-black leading-none text-white transition group-hover:text-blue-300">
                      Mode entraînement
                    </h2>
                  </div>

                  <span className="rounded-full border border-blue-400/30 bg-blue-400/10 px-3 py-1 text-xs font-black text-blue-300">
                    XP
                  </span>
                </div>

                <p className="mt-4 text-sm leading-relaxed text-gray-400">
                  Progresse seul, maîtrise les époques et débloque ta collection historique.
                </p>

                <Link
                  href="/timeline"
                  className="group/timeline mt-6 flex min-h-[190px] flex-col justify-between rounded-3xl border border-amber-500/50 bg-gradient-to-br from-amber-500/20 via-gray-950 to-gray-950 p-5 transition-all hover:-translate-y-1 hover:border-amber-400 hover:shadow-xl hover:shadow-amber-500/10 active:scale-[0.98]"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-6xl leading-none">📅</span>
                      <span className="rounded-full bg-amber-500 px-3 py-1 text-xs font-black text-gray-950">
                        Jeu principal
                      </span>
                    </div>

                    <p className="mt-5 text-3xl font-black text-white">
                      Ligne du temps
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-gray-400">
                      Replace les grands événements sur une frise chronologique.
                    </p>
                  </div>

                  <p className="mt-5 text-sm font-black text-amber-400 transition group-hover/timeline:translate-x-1">
                    Appuie pour lancer →
                  </p>
                </Link>

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <SmallModeCard
                    href="/quiz"
                    emoji="📝"
                    label="Quiz"
                    desc="Cash, Carré ou Duo"
                  />
                  <SmallModeCard
                    href="/game"
                    emoji="🔍"
                    label="Anachronisme"
                    desc="Trouve l’erreur"
                  />
                </div>
              </div>
            </section>

            <section className="group relative overflow-hidden rounded-[2rem] border border-amber-500/30 bg-gradient-to-br from-amber-500/15 via-gray-900 to-gray-950 p-6 shadow-2xl shadow-black/20 transition-all hover:-translate-y-1 hover:border-amber-400 hover:shadow-amber-500/10">
              <div className="absolute -right-14 -top-14 h-44 w-44 rounded-full bg-amber-400/10 blur-3xl transition group-hover:bg-amber-400/20" />
              <div className="absolute bottom-6 right-6 text-[9rem] leading-none opacity-[0.07] transition group-hover:scale-110">
                👥
              </div>

              <div className="relative z-10">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-black uppercase tracking-[0.3em] text-amber-400">
                      Multijoueur
                    </p>
                    <h2 className="mt-2 text-4xl font-black leading-none text-white transition group-hover:text-amber-300">
                      Mode compétition
                    </h2>
                  </div>

                  <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-black text-amber-300">
                    Live
                  </span>
                </div>

                <p className="mt-4 text-sm leading-relaxed text-gray-400">
                  Crée une room, affronte tes amis et grimpe bientôt en ranked.
                </p>

                <Link
                  href="/multiplayer"
                  className="group/room mt-6 block rounded-3xl border border-amber-500/50 bg-gradient-to-br from-amber-500/20 via-gray-950 to-gray-950 p-5 transition-all hover:-translate-y-1 hover:border-amber-400 hover:shadow-xl hover:shadow-amber-500/10 active:scale-[0.98]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-6xl">🏫</span>
                    <span className="rounded-full bg-amber-500 px-3 py-1 text-xs font-black text-gray-950">
                      Jusqu’à 20
                    </span>
                  </div>

                  <p className="mt-5 text-3xl font-black text-white">
                    Salon privé
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-gray-400">
                    Idéal pour une classe, un live, une soirée ou un groupe d’amis.
                  </p>

                  <p className="mt-5 text-sm font-black text-amber-400 transition group-hover/room:translate-x-1">
                    Créer / rejoindre →
                  </p>
                </Link>

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <LockedModeCard
                    emoji="🎮"
                    label="Partie rapide"
                    desc="Matchmaking fun"
                    tag="bientôt"
                  />
                  <LockedModeCard
                    emoji="🏆"
                    label="Classé"
                    desc="ELO & leaderboard"
                    tag="soon"
                  />
                </div>
              </div>
            </section>
          </div>

          <Link
            href="/scoreboard"
            className="group flex items-center gap-4 rounded-3xl border border-gray-800 bg-gray-900 p-5 transition-all hover:-translate-y-0.5 hover:border-amber-500/40 hover:bg-gray-800/80 active:scale-[0.98]"
          >
            <span className="text-3xl leading-none">🏆</span>
            <div className="min-w-0 flex-1">
              <p className="text-base font-black text-white">Classements & scores</p>
              <p className="text-sm text-gray-500">
                Consulte les meilleurs joueurs, les duels et les défis quotidiens.
              </p>
            </div>
            <span className="text-gray-600 transition group-hover:translate-x-1 group-hover:text-amber-400">
              →
            </span>
          </Link>
        </section>
      </main>
    </div>
  );
}