"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase-browser";

type Session = {
  id: string;
  code: string;
  title: string;
  status: "waiting" | "playing" | "finished";
  current_question_index: number;
};

type Player = {
  id: string;
  nickname: string;
  score: number;
};

export default function PlaySessionPage({
  params,
}: {
  params: { sessionId: string };
}) {
  const supabase = useMemo(() => createClient(), []);

  const [session, setSession] = useState<Session | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [nickname, setNickname] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  async function loadPlayers() {
    const { data, error } = await supabase
      .from("session_players")
      .select("id, nickname, score")
      .eq("session_id", params.sessionId)
      .order("joined_at", { ascending: true });

    if (error) {
      setMessage("Impossible de charger les joueurs.");
      return;
    }

    setPlayers((data ?? []) as Player[]);
  }

  async function loadSession() {
    setLoading(true);
    setMessage(null);

    const storedPlayerId = localStorage.getItem("school_session_player_id");
    const storedSessionId = localStorage.getItem("school_session_id");
    const storedNickname = localStorage.getItem("school_session_nickname");

    setPlayerId(storedPlayerId);
    setNickname(storedNickname);

    if (storedSessionId && storedSessionId !== params.sessionId) {
      setMessage("Cette session ne correspond pas à ta dernière connexion.");
      setLoading(false);
      return;
    }

    const { data: sessionData, error: sessionError } = await supabase
      .from("school_game_sessions")
      .select("id, code, title, status, current_question_index")
      .eq("id", params.sessionId)
      .maybeSingle();

    if (sessionError) {
      setMessage("Impossible de charger la session.");
      setLoading(false);
      return;
    }

    if (!sessionData) {
      setMessage("Session introuvable.");
      setLoading(false);
      return;
    }

    setSession(sessionData as Session);
    await loadPlayers();
    setLoading(false);
  }

  useEffect(() => {
    loadSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.sessionId]);

  useEffect(() => {
    const channel = supabase
      .channel(`school-session-${params.sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "school_game_sessions",
          filter: `id=eq.${params.sessionId}`,
        },
        (payload) => {
          setSession(payload.new as Session);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "session_players",
          filter: `session_id=eq.${params.sessionId}`,
        },
        () => {
          loadPlayers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.sessionId, supabase]);

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 p-8 text-white">
        <div className="mx-auto max-w-xl rounded-3xl border border-gray-800 bg-gray-900 p-6">
          Chargement de la session...
        </div>
      </main>
    );
  }

  if (message) {
    return (
      <main className="min-h-screen bg-gray-950 p-8 text-white">
        <div className="mx-auto max-w-xl rounded-3xl border border-red-500/30 bg-red-500/10 p-6">
          <p className="font-bold text-red-300">{message}</p>

          <a
            href="/join"
            className="mt-5 inline-block rounded-xl bg-amber-500 px-5 py-3 font-black text-gray-950"
          >
            Retour rejoindre
          </a>
        </div>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-gray-950 p-8 text-white">
        <div className="mx-auto max-w-xl rounded-3xl border border-gray-800 bg-gray-900 p-6">
          Session introuvable.
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 px-4 py-8 text-white">
      <div className="mx-auto w-full max-w-4xl">
        <div className="rounded-3xl border border-gray-800 bg-gray-900 p-6 shadow-2xl shadow-black/40">
          <p className="text-sm font-bold uppercase tracking-widest text-amber-400">
            Session de classe
          </p>

          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-4xl font-black">{session.title}</h1>

              <p className="mt-2 text-gray-400">
                Code :{" "}
                <span className="font-mono font-black text-amber-400">
                  {session.code}
                </span>
              </p>

              {nickname && (
                <p className="mt-2 text-sm text-gray-500">
                  Tu joues sous le pseudo{" "}
                  <span className="font-bold text-white">{nickname}</span>
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-gray-800 bg-gray-950 px-4 py-3 text-sm">
              Statut :{" "}
              <span className="font-black text-amber-400">
                {session.status === "waiting"
                  ? "En attente"
                  : session.status === "playing"
                    ? "En cours"
                    : "Terminée"}
              </span>
            </div>
          </div>

          {session.status === "waiting" && (
            <div className="mt-8 rounded-3xl border border-amber-500/20 bg-amber-500/10 p-6 text-center">
              <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />

              <h2 className="text-2xl font-black">
                En attente du lancement par le professeur
              </h2>

              <p className="mt-2 text-gray-400">
                Reste sur cette page. La partie commencera automatiquement.
              </p>
            </div>
          )}

          {session.status === "playing" && (
            <div className="mt-8 rounded-3xl border border-green-500/20 bg-green-500/10 p-6 text-center">
              <h2 className="text-2xl font-black text-green-300">
                La partie a commencé
              </h2>

              <p className="mt-2 text-gray-400">
                Prochaine étape : afficher la question en live ici.
              </p>
            </div>
          )}

          {session.status === "finished" && (
            <div className="mt-8 rounded-3xl border border-gray-800 bg-gray-950 p-6 text-center">
              <h2 className="text-2xl font-black">Partie terminée</h2>
            </div>
          )}

          <div className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xl font-black">Participants</h2>

              <span className="rounded-full bg-gray-800 px-3 py-1 text-sm font-bold text-gray-300">
                {players.length}
              </span>
            </div>

            {players.length === 0 ? (
              <div className="rounded-2xl border border-gray-800 bg-gray-950 p-5 text-gray-400">
                Aucun joueur pour le moment.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {players.map((player) => (
                  <div
                    key={player.id}
                    className={`rounded-2xl border p-4 ${
                      player.id === playerId
                        ? "border-amber-500/50 bg-amber-500/10"
                        : "border-gray-800 bg-gray-950"
                    }`}
                  >
                    <p className="font-black">{player.nickname}</p>

                    <p className="mt-1 text-sm text-gray-500">
                      Score : {player.score}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}