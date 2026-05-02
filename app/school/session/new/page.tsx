"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";

function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  return Array.from(
    { length: 6 },
    () => chars[Math.floor(Math.random() * chars.length)]
  ).join("");
}

export default function NewSchoolSessionPage() {
  const supabase = createClient();

  const [title, setTitle] = useState("Quiz de classe");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function createSession() {
    setLoading(true);
    setMessage(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("Tu dois être connecté pour créer une session.");
      setLoading(false);
      return;
    }

    const code = makeCode();

    const { data, error } = await supabase
      .from("school_game_sessions")
      .insert({
        code,
        title: title.trim() || "Quiz de classe",
        teacher_id: user.id,
        status: "waiting",
        game_mode: "quiz",
        current_question_index: 0,
        question_ids: [],
      })
      .select("id")
      .single();

    if (error || !data) {
      setMessage(error?.message ?? "Impossible de créer la session.");
      setLoading(false);
      return;
    }

    window.location.href = `/play/session/${data.id}`;
  }

  return (
    <main className="min-h-screen bg-gray-950 px-4 py-10 text-white">
      <div className="mx-auto flex min-h-[80vh] w-full max-w-xl items-center">
        <div className="w-full rounded-3xl border border-gray-800 bg-gray-900 p-6 shadow-2xl shadow-black/40">
          <p className="text-sm font-bold uppercase tracking-widest text-amber-400">
            Espace professeur
          </p>

          <h1 className="mt-3 text-4xl font-black">Créer une session</h1>

          <p className="mt-2 text-gray-400">
            Crée une partie de classe. Les élèves pourront rejoindre avec un
            code, sans compte.
          </p>

          <div className="mt-6">
            <label className="text-sm font-bold text-gray-300">
              Titre de la session
            </label>

            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") createSession();
              }}
              className="mt-2 w-full rounded-2xl border border-gray-700 bg-gray-950 px-4 py-3 text-white outline-none placeholder:text-gray-600 focus:border-amber-500"
              placeholder="Ex : Révolution française"
            />
          </div>

          {message && (
            <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm font-bold text-amber-300">
              {message}
            </div>
          )}

          <button
            type="button"
            onClick={createSession}
            disabled={loading}
            className="mt-6 w-full rounded-2xl bg-amber-500 px-5 py-4 font-black text-gray-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Création..." : "Créer la session"}
          </button>

          <a
            href="/join"
            className="mt-3 block text-center text-sm font-bold text-gray-500 transition hover:text-amber-400"
          >
            Rejoindre une session élève
          </a>
        </div>
      </div>
    </main>
  );
}