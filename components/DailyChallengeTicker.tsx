import Link from "next/link";

export default function DailyChallengeTicker({
  isLoggedIn,
  played,
  score,
  maxScore,
  rank,
  streak,
}: {
  isLoggedIn: boolean;
  played: boolean;
  score?: number;
  maxScore?: number;
  rank?: number;
  streak: number;
}) {
  return (
    <div className="relative z-20 overflow-hidden border-y border-amber-500/20 bg-amber-500/10">
      <Link
        href={isLoggedIn ? "/timeline/daily" : "/"}
        className="group flex items-center gap-6 whitespace-nowrap px-4 py-3 text-sm font-bold text-amber-100"
      >
        <div className="animate-[ticker_22s_linear_infinite]">
          🔥 Défi du jour ·{" "}
          {played ? (
            <>
              Score :{" "}
              <span className="text-amber-400">
                {score}/{maxScore}
              </span>{" "}
              · Rang :{" "}
              <span className="text-amber-400">
                #{rank ?? "?"}
              </span>{" "}
              · Streak :{" "}
              <span className="text-amber-400">{streak}j</span>{" "}
              · Revoir le défi →
            </>
          ) : isLoggedIn ? (
            <>
              Nouveau défi quotidien disponible · Garde ton streak de{" "}
              <span className="text-amber-400">{streak}j</span> · Jouer maintenant →
            </>
          ) : (
            <>Connecte-toi pour participer au défi quotidien →</>
          )}
        </div>
      </Link>
    </div>
  );
}