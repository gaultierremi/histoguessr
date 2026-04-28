import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import AuthButton from "@/components/AuthButton";
import DailyHeroCard from "@/components/DailyHeroCard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ── Daily status (only if logged in) ──────────────────────────────────────
  let dailyProps: {
    isLoggedIn: boolean;
    played: boolean;
    score?: number;
    maxScore?: number;
    rank?: number;
  } = { isLoggedIn: false, played: false };

  if (user) {
    const today = new Date().toISOString().slice(0, 10);
    const { data: challenge } = await supabase
      .from("daily_challenges")
      .select("id")
      .eq("date", today)
      .maybeSingle();

    if (challenge) {
      const { data: myScore } = await supabase
        .from("daily_scores")
        .select("score, max_score")
        .eq("user_id", user.id)
        .eq("challenge_id", (challenge as { id: string }).id)
        .maybeSingle();

      if (myScore) {
        const { count } = await supabase
          .from("daily_scores")
          .select("id", { count: "exact", head: true })
          .eq("challenge_id", (challenge as { id: string }).id)
          .gt("score", (myScore as { score: number; max_score: number }).score);

        dailyProps = {
          isLoggedIn: true,
          played:     true,
          score:      (myScore as { score: number; max_score: number }).score,
          maxScore:   (myScore as { score: number; max_score: number }).max_score,
          rank:       (count ?? 0) + 1,
        };
      } else {
        dailyProps = { isLoggedIn: true, played: false };
      }
    } else {
      dailyProps = { isLoggedIn: true, played: false };
    }
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gray-950 px-4 py-12">
      {/* Top-right auth */}
      <div className="absolute right-4 top-4 z-20">
        <AuthButton />
      </div>

      {/* Vignette */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.7) 100%)",
        }}
      />

      {/* Amber ambient glow */}
      <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div
          className="h-[500px] w-[500px] rounded-full opacity-[0.07] blur-3xl"
          style={{ background: "radial-gradient(circle, #f59e0b, transparent 70%)" }}
        />
      </div>

      {/* Main content */}
      <div className="relative z-10 flex w-full max-w-xl flex-col items-center gap-8">
        {/* Badge + Title */}
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-amber-400">
            Histoire &amp; Découverte
          </span>
          <h1 className="text-7xl font-black tracking-tighter text-white sm:text-8xl">
            Histo<span className="text-amber-400">Guess</span>
          </h1>
          <p className="text-base text-gray-400">
            Teste ta maîtrise de la chronologie et de l&apos;Histoire
          </p>
        </div>

        {/* Hero card — Ligne du temps + Défi quotidien */}
        <div className="w-full">
          <DailyHeroCard {...dailyProps} />
        </div>

        {/* Secondary game modes */}
        <div className="flex w-full flex-col gap-2">
          <p className="text-xs uppercase tracking-widest text-gray-600">Autres modes</p>
          <div className="grid grid-cols-3 gap-2">
            <Link
              href="/game"
              className="group flex flex-col items-center gap-2 rounded-xl border border-gray-800 bg-gray-900 px-3 py-4 transition-all hover:border-gray-700 hover:bg-gray-800/80 active:scale-95"
            >
              <span className="text-xl">🔍</span>
              <span className="text-sm font-semibold text-gray-300 group-hover:text-white">Anachronisme</span>
            </Link>
            <Link
              href="/quiz"
              className="group flex flex-col items-center gap-2 rounded-xl border border-gray-800 bg-gray-900 px-3 py-4 transition-all hover:border-gray-700 hover:bg-gray-800/80 active:scale-95"
            >
              <span className="text-xl">📝</span>
              <span className="text-sm font-semibold text-gray-300 group-hover:text-white">Quiz</span>
            </Link>
            <Link
              href="/duel"
              className="group flex flex-col items-center gap-2 rounded-xl border border-gray-800 bg-gray-900 px-3 py-4 transition-all hover:border-amber-700/40 hover:bg-gray-800/80 active:scale-95"
            >
              <span className="text-xl">⚔️</span>
              <span className="text-sm font-semibold text-gray-300 group-hover:text-white">Duel</span>
            </Link>
          </div>
        </div>

        {/* Scoreboard link */}
        <Link
          href="/scoreboard"
          className="text-sm text-gray-600 transition-colors hover:text-gray-400"
        >
          🏆 Scoreboard
        </Link>
      </div>
    </main>
  );
}
