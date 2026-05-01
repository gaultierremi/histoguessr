"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export default function JoinSessionPage() {
  const router = useRouter();
  const supabase = createClient();

  const [code, setCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function joinSession() {
    const cleanCode = code.trim().toUpperCase();
    const cleanNickname = nickname.trim();

    if (!cleanCode || !cleanNickname) {
      setMessage("Entre un code et un pseudo.");
      return;
    }

    setLoading(true);
    setMessage(null);

    const { data: session, error: sessionError } = await supabase
      .from("school_game_sessions")
      .select("id, code, status")
      .eq("code", cleanCode)
      .maybeSingle();

    if (sessionError || !session) {
      setMessage("Session introuvable.");
      setLoading(false);
      return;
    }

    if (session.status === "finished") {
      setMessage("Cette session est terminée.");
      setLoading(false);
      return;
    }

    const { data: player, error: playerError } = await supabase
      .from("session_players")
      .insert({
        session_id: session.id,
        nickname: cleanNickname,
      })
      .select("id")
      .single();

    if (playerError || !player) {
      setMessage("Impossible de rejoindre la session.");
      setLoading(false);
      return;
    }

    localStorage.setItem("school_session_player_id", player.id);
    localStorage.setItem("school_session_id", session.id);
    localStorage.setItem("school_session_nickname", cleanNickname);

    router.push(`/play/session/${session.id}`);
  }

  return (
    <main className="min-h-screen bg-gray-950 px-4 py-10 text-white">
      <div className="mx-auto flex min-h-[80vh] w-full max-w-xl items-center">
        <div className="w-full rounded-3xl border border-gray-800 bg-gray-900 p-6 shadow-2xl shadow-black/40">
          <p className="text-sm font-bold uppercase tracking-widest text-amber-400">
            Rejoindre une classe
          </p>

          <h1 className="mt-3 text-4xl font-black">
            Entre le code du prof
          </h1>

          <p className="mt-2 text-gray-400">
            Pas besoin de compte. Choisis un pseudo et rejoins la partie.
          </p>

          <div className="mt-6 space-y-4">
            <div>
              <label className="text-sm font-bold text-gray-300">
                Code
              </label>
              <input
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                placeholder="ABCD12"
                maxLength={8}
                className="mt-2 w-full rounded-2xl border border-gray-700 bg-gray-950 px-4 py-4 text-center font-mono text-3xl font-black uppercase tracking-widest text-amber-400 outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="text-sm font-bold text-gray-300">
                Ton pseudo
              </label>
              <input
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") joinSession();
                }}
                placeholder="Ex : Lucas"
                maxLength={24}
                className="mt-2 w-full rounded-2xl border border-gray-700 bg-gray-950 px-4 py-3 text-white outline-none placeholder:text-gray-600 focus:border-amber-500"
              />
            </div>

            {message && (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm font-bold text-amber-300">
                {message}
              </div>
            )}

            <button
              type="button"
              onClick={joinSession}
              disabled={loading}
              className="w-full rounded-2xl bg-amber-500 px-5 py-4 font-black text-gray-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Connexion..." : "Rejoindre"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}