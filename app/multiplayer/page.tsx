"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import {
  createRoom,
  joinRoom,
  type MultiplayerGameMode,
} from "@/lib/multiplayer";

export default function MultiplayerPage() {
  const supabase = createClient();

  const [code, setCode] = useState("");
  const [gameMode, setGameMode] = useState<MultiplayerGameMode>("quiz");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleCreate() {
    setLoading(true);
    setMessage(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("Tu dois être connecté pour créer un salon.");
      setLoading(false);
      return;
    }

    try {
      const room = await createRoom(
        supabase,
        user.id,
        user.user_metadata?.name ||
          user.user_metadata?.full_name ||
          user.email ||
          "Joueur",
        1,
        gameMode
      );

      window.location.href = `/multiplayer/${room.code}`;
    } catch {
      setMessage("Impossible de créer le salon.");
      setLoading(false);
    }
  }

  async function handleJoin() {
    if (!code.trim()) {
      setMessage("Entre un code de salon.");
      return;
    }

    setLoading(true);
    setMessage(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("Tu dois être connecté pour rejoindre un salon.");
      setLoading(false);
      return;
    }

    try {
      await joinRoom(
        supabase,
        code.trim(),
        user.id,
        user.user_metadata?.name ||
          user.user_metadata?.full_name ||
          user.email ||
          "Joueur"
      );

      window.location.href = `/multiplayer/${code.trim()}`;
    } catch {
      setMessage("Impossible de rejoindre ce salon.");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-950 px-4 py-10 text-white">
      <div className="mx-auto max-w-3xl">
        <div className="overflow-hidden rounded-3xl border border-gray-800 bg-gray-900 shadow-2xl shadow-black/30">
          <div className="bg-gradient-to-br from-amber-500/20 via-gray-900 to-gray-950 p-7">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-amber-400">
              Multijoueur
            </p>

            <h1 className="mt-3 text-4xl font-black">
              Créer ou rejoindre un salon
            </h1>

            <p className="mt-2 text-sm leading-relaxed text-gray-400">
              Choisis un mode, invite tes joueurs avec un code, puis lance la
              partie quand tout le monde est prêt.
            </p>
          </div>

          <div className="grid gap-6 p-6 md:grid-cols-2">
            <section className="rounded-3xl border border-gray-800 bg-gray-950 p-5">
              <h2 className="text-xl font-black">Créer un salon</h2>

              <p className="mt-1 text-sm text-gray-500">
                Le mode choisi sera utilisé par tous les joueurs.
              </p>

              <div className="mt-5 grid gap-3">
                <button
                  type="button"
                  onClick={() => setGameMode("quiz")}
                  className={`rounded-2xl border p-4 text-left transition ${
                    gameMode === "quiz"
                      ? "border-amber-400 bg-amber-500/10"
                      : "border-gray-800 bg-gray-900 hover:border-gray-700"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-2xl">📝</span>
                    {gameMode === "quiz" && (
                      <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-black text-gray-950">
                        Sélectionné
                      </span>
                    )}
                  </div>
                  <p className="mt-3 font-black text-white">Quiz</p>
                  <p className="mt-1 text-sm text-gray-500">
                    Cash, Carré, Duo, timer et bonus vitesse.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setGameMode("timeline")}
                  className={`rounded-2xl border p-4 text-left transition ${
                    gameMode === "timeline"
                      ? "border-amber-400 bg-amber-500/10"
                      : "border-gray-800 bg-gray-900 hover:border-gray-700"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-2xl">📅</span>
                    {gameMode === "timeline" && (
                      <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-black text-gray-950">
                        Sélectionné
                      </span>
                    )}
                  </div>
                  <p className="mt-3 font-black text-white">Ligne du temps</p>
                  <p className="mt-1 text-sm text-gray-500">
                    Place l’année exacte avant les autres joueurs.
                  </p>
                </button>
              </div>

              <button
                type="button"
                onClick={handleCreate}
                disabled={loading}
                className="mt-6 w-full rounded-2xl bg-amber-500 px-6 py-3 font-black text-gray-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Créer le salon
              </button>
            </section>

            <section className="rounded-3xl border border-gray-800 bg-gray-950 p-5">
              <h2 className="text-xl font-black">Rejoindre un salon</h2>

              <p className="mt-1 text-sm text-gray-500">
                Entre le code donné par le créateur.
              </p>

              <input
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                placeholder="Code"
                maxLength={4}
                className="mt-5 w-full rounded-2xl border border-gray-800 bg-gray-900 px-4 py-3 text-center text-2xl font-black tracking-[0.3em] text-white placeholder-gray-700 outline-none transition focus:border-amber-500"
              />

              <button
                type="button"
                onClick={handleJoin}
                disabled={loading}
                className="mt-4 w-full rounded-2xl border border-blue-500/40 bg-blue-500/10 px-6 py-3 font-black text-blue-300 transition hover:border-blue-400 hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Rejoindre
              </button>

              <div className="mt-6 rounded-2xl border border-gray-800 bg-gray-900 p-4">
                <p className="text-sm font-bold text-white">Modes disponibles</p>
                <p className="mt-1 text-xs leading-relaxed text-gray-500">
                  Le mode est défini par le créateur du salon. Tu n’as besoin
                  que du code pour rejoindre.
                </p>
              </div>
            </section>
          </div>

          {message && (
            <div className="border-t border-gray-800 p-5">
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm font-bold text-red-300">
                {message}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}