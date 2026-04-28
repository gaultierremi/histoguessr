"use client";

import { useState } from "react";
import Link from "next/link";
import TimelineGame from "@/components/TimelineGame";
import { saveDailyScore } from "@/lib/daily";
import type { TimelineEvent } from "@/lib/types";

type Props = {
  events:      TimelineEvent[];
  challengeId: string;
  userId:      string;
  userName:    string;
};

export default function DailyTimelineWrapper({ events, challengeId, userId, userName }: Props) {
  const [result, setResult]   = useState<{ score: number; maxScore: number } | null>(null);
  const [saving, setSaving]   = useState(false);
  const [saved,  setSaved]    = useState(false);

  async function handleComplete(score: number, maxScore: number) {
    setSaving(true);
    await saveDailyScore(userId, userName, challengeId, score, maxScore);
    setSaving(false);
    setSaved(true);
    setResult({ score, maxScore });
  }

  if (saving) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-gray-400">Sauvegarde en cours…</p>
      </div>
    );
  }

  if (saved && result) {
    const pct = Math.round((result.score / result.maxScore) * 100);
    const emoji = pct >= 90 ? "🏆" : pct >= 60 ? "⭐" : "📍";
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-6 px-4 py-16 text-center">
        <span className="text-5xl">{emoji}</span>
        <div>
          <p className="text-xs uppercase tracking-widest text-gray-500">⚡ Défi du jour · Score final</p>
          <p className="mt-2 text-6xl font-black text-white">
            {result.score}
            <span className="text-2xl font-normal text-gray-600"> / {result.maxScore}</span>
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/scoreboard?tab=daily"
            className="rounded-xl bg-amber-500 px-8 py-3 font-bold text-gray-950 transition-colors hover:bg-amber-400"
          >
            Voir le classement
          </Link>
          <Link
            href="/"
            className="rounded-xl border border-gray-700 px-8 py-3 font-semibold text-gray-300 transition-colors hover:border-gray-500 hover:text-white"
          >
            Accueil
          </Link>
        </div>
      </div>
    );
  }

  return (
    <TimelineGame
      events={events}
      difficulty={2}
      onComplete={handleComplete}
    />
  );
}
