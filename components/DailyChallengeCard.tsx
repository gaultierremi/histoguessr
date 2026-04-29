"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type Variant = "card" | "banner";

type Props = {
  isLoggedIn: boolean;
  played:     boolean;
  score?:     number;
  maxScore?:  number;
  rank?:      number;
  streak:     number;
  variant?:   Variant;
};

function useCountdownTick(): { label: string; tick: boolean } {
  const [label, setLabel] = useState("--:--:--");
  const [tick,  setTick]  = useState(false);

  function compute() {
    const now = new Date();
    const midnight = new Date(Date.UTC(
      now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1,
    ));
    const diff = Math.max(0, midnight.getTime() - now.getTime());
    const h = Math.floor(diff / 3_600_000);
    const m = Math.floor((diff % 3_600_000) / 60_000);
    const s = Math.floor((diff % 60_000) / 1_000);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  useEffect(() => {
    setLabel(compute());
    const id = setInterval(() => { setLabel(compute()); setTick((t) => !t); }, 1_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { label, tick };
}

function encouragement(score: number, maxScore: number): string {
  const pct = score / maxScore;
  if (pct >= 0.85) return "Excellent ! Tu domines le classement 🏆";
  if (pct >= 0.65) return "Belle performance ! Continue comme ça ⭐";
  return "Tu feras encore mieux demain ! 💪";
}

export default function DailyChallengeCard({
  isLoggedIn, played, score, maxScore, rank, streak, variant = "card",
}: Props) {
  const { label, tick } = useCountdownTick();
  const isBanner = variant === "banner";

  // Color tokens per variant
  const c = isBanner
    ? {
        wrap:        "border-l-4 border-amber-600 rounded-r-2xl bg-gradient-to-br from-amber-500 to-amber-400 p-5",
        shadow:      "0 4px 28px rgba(245,158,11,0.35)",
        title:       "text-gray-950",
        streak:      "text-gray-800",
        sub:         "text-gray-800/70",
        cdLabel:     "text-gray-800/70",
        cdValue:     "text-gray-950",
        desc:        "text-gray-900/70",
        scoreVal:    "text-green-900",
        scoreSub:    "text-gray-900/60",
        scoreRank:   "text-gray-900/70",
        scoreRankHl: "text-gray-950",
        rankLink:    "rounded-xl border border-gray-950/20 bg-gray-950/10 px-4 py-2 text-sm font-semibold text-gray-950 transition-colors hover:bg-gray-950/20",
        encourage:   "text-gray-900/60",
        btn:         "bg-gray-950 text-amber-400 shadow-none hover:bg-gray-800",
        btnShadow:   "",
      }
    : {
        wrap:        "rounded-2xl border border-amber-500/30 bg-gradient-to-br from-gray-900 to-gray-950 p-5",
        shadow:      "0 0 48px rgba(245,158,11,0.12), 0 4px 24px rgba(0,0,0,0.4)",
        title:       "text-white",
        streak:      "text-amber-400/80",
        sub:         "text-gray-500",
        cdLabel:     "text-gray-600",
        cdValue:     "text-amber-400",
        desc:        "text-gray-500",
        scoreVal:    "text-amber-400",
        scoreSub:    "text-gray-600",
        scoreRank:   "text-gray-500",
        scoreRankHl: "text-white",
        rankLink:    "shrink-0 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-400 transition-colors hover:bg-amber-500/20",
        encourage:   "text-gray-500",
        btn:         "bg-amber-500 text-gray-950 shadow-lg shadow-amber-500/25 hover:bg-amber-400 hover:shadow-amber-400/35",
        btnShadow:   "",
      };

  return (
    <div className={c.wrap} style={{ boxShadow: c.shadow }}>
      {/* Header row */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className={`text-lg font-black ${c.title}`}>⚡ Défi du jour</span>
            {streak > 0 && <span className="animate-pulse text-lg leading-none">🔥</span>}
          </div>
          {streak > 0 && (
            <p className={`mt-0.5 text-xs font-medium ${c.streak}`}>
              {streak} jour{streak > 1 ? "s" : ""} de suite !
            </p>
          )}
        </div>

        {/* Countdown */}
        <div className="flex shrink-0 flex-col items-end">
          <span className={`text-xs ${c.cdLabel}`}>Reset dans</span>
          <span
            className={`font-mono text-sm font-bold transition-opacity duration-500 ${c.cdValue}`}
            style={{ opacity: tick ? 1 : 0.6 }}
            suppressHydrationWarning
          >
            {label}
          </span>
        </div>
      </div>

      {/* Content */}
      {played && score !== undefined && maxScore !== undefined ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between rounded-xl border border-black/10 bg-black/10 px-4 py-3">
            <div>
              <p className={`text-xs ${c.scoreSub}`}>Ton score du jour</p>
              <p className={`text-3xl font-black ${c.scoreVal}`}>
                {score}
                <span className={`text-sm font-normal ${c.scoreSub}`}> / {maxScore}</span>
              </p>
              {rank !== undefined && (
                <p className={`mt-0.5 text-xs ${c.scoreRank}`}>
                  Classement :{" "}
                  <span className={`font-bold ${c.scoreRankHl}`}>#{rank}</span>
                </p>
              )}
            </div>
            <Link href="/scoreboard?tab=daily" className={c.rankLink}>
              Classement →
            </Link>
          </div>
          <p className={`text-center text-xs ${c.encourage}`}>
            {encouragement(score, maxScore)}
          </p>
        </div>
      ) : isLoggedIn ? (
        <div className="flex flex-col gap-3">
          <p className={`text-sm ${c.desc}`}>
            10 événements · Niveaux mixtes · Même défi pour tous
          </p>
          <Link
            href="/timeline/daily"
            className={`group flex items-center justify-center gap-2 rounded-xl py-4 text-base font-bold transition-all active:scale-[0.98] ${c.btn}`}
          >
            ⚡ Relever le défi
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:translate-x-1">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </Link>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 py-1">
          <p className={`text-sm ${c.desc}`}>10 événements · Même défi pour tout le monde</p>
          <p className={`text-xs ${c.cdLabel}`}>Connecte-toi pour participer et sauvegarder ton score</p>
        </div>
      )}
    </div>
  );
}
