"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type Props = {
  isLoggedIn: boolean;
  played:     boolean;
  score?:     number;
  maxScore?:  number;
  rank?:      number;
};

function useCountdown(): string {
  const [label, setLabel] = useState("--:--:--");

  function compute() {
    const now      = new Date();
    const midnight = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
    ));
    const diff = Math.max(0, midnight.getTime() - now.getTime());
    const h    = Math.floor(diff / 3_600_000);
    const m    = Math.floor((diff % 3_600_000) / 60_000);
    const s    = Math.floor((diff % 60_000) / 1_000);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  useEffect(() => {
    setLabel(compute());
    const id = setInterval(() => setLabel(compute()), 1_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return label;
}

export default function DailyHeroCard({ isLoggedIn, played, score, maxScore, rank }: Props) {
  const countdown = useCountdown();

  return (
    <div
      className="w-full rounded-2xl border border-amber-500/20 bg-gradient-to-br from-gray-900 to-gray-950 p-6"
      style={{ boxShadow: "0 0 40px rgba(245,158,11,0.08)" }}
    >
      {/* Timeline header */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <span className="text-xs uppercase tracking-widest text-amber-400/70">Jeu principal</span>
          <h2 className="mt-1 text-2xl font-black text-white">📅 Ligne du temps</h2>
          <p className="mt-1 text-sm text-gray-500">Place chaque événement sur la frise pour marquer des points</p>
        </div>
        <Link
          href="/timeline"
          className="shrink-0 rounded-xl border border-gray-700 px-4 py-2 text-sm font-semibold text-gray-400 transition-colors hover:border-gray-500 hover:text-white"
        >
          Libre
        </Link>
      </div>

      {/* Divider */}
      <div className="mb-5 h-px bg-gray-800" />

      {/* Daily challenge section */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-base font-bold text-white">⚡ Défi du jour</span>
          <span className="text-xs text-gray-600">
            Reset dans{" "}
            <span className="font-mono font-semibold text-amber-400" suppressHydrationWarning>
              {countdown}
            </span>
          </span>
        </div>

        {played && score !== undefined && maxScore !== undefined ? (
          <div className="flex items-center justify-between rounded-xl border border-gray-800 bg-gray-900/60 px-4 py-3">
            <div>
              <p className="text-xs text-gray-500">Ton score du jour</p>
              <p className="text-2xl font-black text-amber-400">
                {score}
                <span className="text-sm font-normal text-gray-600"> / {maxScore}</span>
              </p>
              {rank !== undefined && (
                <p className="text-xs text-gray-500">
                  Rang{" "}
                  <span className="font-bold text-white">#{rank}</span>
                </p>
              )}
            </div>
            <Link
              href="/scoreboard?tab=daily"
              className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-400 transition-colors hover:bg-amber-500/20"
            >
              Classement →
            </Link>
          </div>
        ) : (
          <Link
            href={isLoggedIn ? "/timeline/daily" : "/"}
            className="group flex items-center justify-center gap-2 rounded-xl bg-amber-500 py-4 text-base font-bold text-gray-950 shadow-lg shadow-amber-500/20 transition-all hover:bg-amber-400 hover:shadow-amber-400/30 active:scale-95"
          >
            Jouer le défi
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:translate-x-1">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </Link>
        )}

        {!isLoggedIn && (
          <p className="text-center text-xs text-gray-600">Connecte-toi pour participer au défi quotidien</p>
        )}
      </div>
    </div>
  );
}
