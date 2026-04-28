import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import Header from "@/components/Header";
import {
  getDailyChallenge,
  hasPlayedToday,
  getUserDailyResult,
} from "@/lib/daily";
import DailyTimelineWrapper from "@/components/DailyTimelineWrapper";

export const dynamic = "force-dynamic";

export default async function DailyPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const userName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    user.email?.split("@")[0] ??
    "Joueur";

  const today = new Date().toISOString().slice(0, 10);

  const { challenge, events } = await getDailyChallenge(supabase);

  const played = await hasPlayedToday(supabase, user.id);

  if (played) {
    const myResult = await getUserDailyResult(supabase, user.id, challenge.id);
    return (
      <main className="flex min-h-screen flex-col bg-gray-950">
        <Header />
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-20 text-center">
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-amber-400">
            ⚡ Défi du jour · {today}
          </span>
          <p className="text-sm text-gray-500">Tu as déjà participé au défi d&apos;aujourd&apos;hui !</p>
          {myResult && (
            <div className="flex flex-col items-center gap-1">
              <p className="text-xs uppercase tracking-widest text-gray-600">Ton score</p>
              <p className="text-6xl font-black text-white">
                {myResult.score}
                <span className="text-2xl font-normal text-gray-600"> / {myResult.max_score}</span>
              </p>
            </div>
          )}
          <div className="flex gap-3">
            <Link
              href="/scoreboard?tab=daily"
              className="rounded-xl bg-amber-500 px-8 py-3 font-bold text-gray-950 transition-colors hover:bg-amber-400"
            >
              Classement du jour
            </Link>
            <Link
              href="/"
              className="rounded-xl border border-gray-700 px-8 py-3 font-semibold text-gray-300 transition-colors hover:border-gray-500 hover:text-white"
            >
              Accueil
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-gray-950">
      <Header />
      <div className="flex-1 px-4">
        <div className="mx-auto max-w-5xl pt-4">
          <div className="mb-4 flex items-center gap-3">
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-amber-400">
              ⚡ Défi du jour · {today}
            </span>
            <span className="text-sm text-gray-600">10 événements · Niveaux mixtes</span>
          </div>
        </div>
        <DailyTimelineWrapper
          events={events}
          challengeId={challenge.id}
          userId={user.id}
          userName={userName}
        />
      </div>
    </main>
  );
}
