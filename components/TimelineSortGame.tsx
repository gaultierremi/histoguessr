"use client";

import { useState } from "react";
import type { TimelineEvent } from "@/lib/types";

export default function TimelineSortGame({
  events,
  difficulty,
}: {
  events: TimelineEvent[];
  difficulty: 1 | 2 | 3;
}) {
  // events are already shuffled by getTimelineEvents
  const [order, setOrder]       = useState<TimelineEvent[]>(events);
  const [validated, setValidated] = useState(false);

  const sorted = [...events].sort((a, b) => a.year - b.year);

  function move(index: number, dir: -1 | 1) {
    if (validated) return;
    const target = index + dir;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
  }

  const score = validated
    ? order.reduce((s, e, i) => s + (e.id === sorted[i].id ? 200 : 0), 0)
    : 0;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 py-8">
      {/* Header */}
      <div className="text-center">
        <span className="inline-block rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-amber-400">
          🔀 Mode Tri
        </span>
        {validated ? (
          <div className="mt-4">
            <p className="text-4xl font-black text-white">
              {score}
              <span className="text-xl font-normal text-gray-500"> / 1000</span>
            </p>
            <p className="mt-1 text-sm text-gray-400">
              {score / 200} événement{score / 200 !== 1 ? "s" : ""} bien placé
              {score / 200 !== 1 ? "s" : ""}
            </p>
          </div>
        ) : (
          <p className="mt-3 text-gray-400">
            Remets ces événements dans l&apos;ordre chronologique
          </p>
        )}
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-3">
        {order.map((e, i) => {
          const correct = validated && e.id === sorted[i].id;
          const wrong   = validated && e.id !== sorted[i].id;
          const correctPos = sorted.findIndex((s) => s.id === e.id) + 1;

          return (
            <div
              key={e.id}
              className={`flex items-center gap-3 rounded-xl border p-4 transition-all ${
                correct
                  ? "border-green-700 bg-green-950/40"
                  : wrong
                  ? "border-red-800 bg-red-950/30"
                  : "border-gray-800 bg-gray-900"
              }`}
            >
              {/* Position badge */}
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm font-bold ${
                  correct
                    ? "border-green-600 text-green-400"
                    : wrong
                    ? "border-red-700 text-red-400"
                    : "border-gray-700 text-gray-500"
                }`}
              >
                {i + 1}
              </span>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <p className="font-semibold leading-snug text-white">{e.title}</p>
                {e.category && (
                  <p className="mt-0.5 text-xs text-gray-500">{e.category}</p>
                )}
                {validated && (
                  <p
                    className={`mt-1 text-sm font-bold ${
                      correct ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {e.year}
                    {wrong && (
                      <span className="font-normal text-gray-500">
                        {" "}
                        · position correcte&nbsp;: {correctPos}
                      </span>
                    )}
                  </p>
                )}
              </div>

              {/* Move buttons */}
              {!validated && (
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-700 text-gray-400 transition-colors hover:border-amber-500/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-20"
                    aria-label="Monter"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => move(i, 1)}
                    disabled={i === order.length - 1}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-700 text-gray-400 transition-colors hover:border-amber-500/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-20"
                    aria-label="Descendre"
                  >
                    ↓
                  </button>
                </div>
              )}

              {/* Result icon */}
              {validated && (
                <span className="shrink-0 text-xl">
                  {correct ? "✅" : "❌"}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Actions */}
      {!validated ? (
        <button
          onClick={() => setValidated(true)}
          className="w-full rounded-xl bg-amber-500 py-3 font-bold text-gray-950 transition-colors hover:bg-amber-400"
        >
          Valider l&apos;ordre
        </button>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Correct order recap */}
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
            <p className="mb-3 text-xs uppercase tracking-wider text-gray-500">
              Ordre chronologique correct
            </p>
            <div className="flex flex-col gap-2">
              {sorted.map((e, i) => (
                <p key={e.id} className="text-sm text-gray-300">
                  <span className="mr-2 text-gray-600">{i + 1}.</span>
                  <span className="font-medium">{e.title}</span>
                  <span className="ml-2 text-amber-400">({e.year})</span>
                </p>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <a
              href={`/timeline?mode=sort&difficulty=${difficulty}`}
              className="flex-1 rounded-xl bg-amber-500 py-3 text-center font-bold text-gray-950 transition-colors hover:bg-amber-400"
            >
              Rejouer
            </a>
            <a
              href="/timeline"
              className="flex-1 rounded-xl border border-gray-700 py-3 text-center font-semibold text-gray-300 transition-colors hover:border-gray-500 hover:text-white"
            >
              Changer de mode
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
