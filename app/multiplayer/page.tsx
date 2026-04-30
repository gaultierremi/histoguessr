"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { createRoom, joinRoom } from "@/lib/multiplayer";

export default function MultiplayerPage() {
  const supabase = createClient();

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const room = await createRoom(
      supabase,
      user.id,
      user.user_metadata.name || "Joueur",
      1
    );

    window.location.href = `/multiplayer/${room.code}`;
  }

  async function handleJoin() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    await joinRoom(
      supabase,
      code,
      user.id,
      user.user_metadata.name || "Joueur"
    );

    window.location.href = `/multiplayer/${code}`;
  }

  return (
    <div className="p-10 text-center text-white">
      <h1 className="text-3xl font-bold">Multijoueur</h1>

      <div className="mt-6 flex flex-col items-center gap-4">
        <button
          onClick={handleCreate}
          disabled={loading}
          className="rounded bg-amber-500 px-6 py-3 font-bold text-black"
        >
          Créer un salon
        </button>

        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Code"
          className="rounded px-4 py-2 text-black"
        />

        <button
          onClick={handleJoin}
          disabled={loading}
          className="rounded bg-blue-500 px-6 py-3 font-bold"
        >
          Rejoindre
        </button>
      </div>
    </div>
  );
}