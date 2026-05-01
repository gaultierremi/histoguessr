"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase-browser";

type Validator = {
  user_id: string;
  email: string | null;
  created_at: string;
};

export default function AdminValidatorsPage() {
  const supabase = useMemo(() => createClient(), []);

  const [validators, setValidators] = useState<Validator[]>([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function loadValidators() {
    setLoading(true);

    const { data, error } = await supabase
      .from("validators")
      .select("user_id, email, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage("Impossible de charger les validateurs.");
      setLoading(false);
      return;
    }

    setValidators((data ?? []) as Validator[]);
    setLoading(false);
  }

  async function addValidator() {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) return;

    setSaving(true);
    setMessage(null);

    const { error } = await supabase.rpc("add_validator_by_email", {
      target_email: cleanEmail,
    });

    if (error) {
      setMessage(
        error.message.includes("User not found")
          ? "Utilisateur introuvable. Il doit d'abord s'être connecté au site avec Google."
          : "Impossible d'ajouter ce validateur."
      );
      setSaving(false);
      return;
    }

    setEmail("");
    setMessage("Validateur ajouté.");
    await loadValidators();
    setSaving(false);
  }

  async function removeValidator(userId: string) {
    const ok = confirm("Retirer ce validateur ?");
    if (!ok) return;

    setMessage(null);

    const { error } = await supabase.rpc("remove_validator", {
      target_user_id: userId,
    });

    if (error) {
      setMessage("Impossible de retirer ce validateur.");
      return;
    }

    setMessage("Validateur retiré.");
    await loadValidators();
  }

  useEffect(() => {
    loadValidators();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-screen bg-gray-950 px-4 py-8 text-white">
      <div className="mx-auto w-full max-w-5xl">
        <div className="rounded-3xl border border-gray-800 bg-gray-900 p-6">
          <p className="text-sm font-bold uppercase tracking-widest text-amber-400">
            Administration
          </p>

          <h1 className="mt-2 text-4xl font-black">Validateurs</h1>

          <p className="mt-2 text-gray-400">
            Ajoute ici les utilisateurs autorisés à envoyer des questions en
            révision ou à les supprimer.
          </p>

          <div className="mt-6 rounded-2xl border border-gray-800 bg-gray-950 p-4">
            <label className="text-sm font-bold text-gray-300">
              Email Google du validateur
            </label>

            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") addValidator();
                }}
                placeholder="exemple@gmail.com"
                className="flex-1 rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-white placeholder-gray-600 outline-none focus:border-amber-500"
              />

              <button
                type="button"
                onClick={addValidator}
                disabled={saving || !email.trim()}
                className="rounded-xl bg-amber-500 px-5 py-3 text-sm font-black text-gray-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving ? "Ajout..." : "Ajouter"}
              </button>
            </div>

            <p className="mt-2 text-xs text-gray-500">
              L’utilisateur doit déjà s’être connecté au site au moins une fois.
            </p>
          </div>

          {message && (
            <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm font-bold text-amber-300">
              {message}
            </div>
          )}

          <div className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xl font-black">Liste des validateurs</h2>

              <span className="rounded-full bg-gray-800 px-3 py-1 text-sm font-bold text-gray-300">
                {validators.length}
              </span>
            </div>

            {loading ? (
              <div className="rounded-2xl border border-gray-800 bg-gray-950 p-5 text-gray-400">
                Chargement...
              </div>
            ) : validators.length === 0 ? (
              <div className="rounded-2xl border border-gray-800 bg-gray-950 p-5 text-gray-400">
                Aucun validateur.
              </div>
            ) : (
              <div className="space-y-3">
                {validators.map((validator) => (
                  <div
                    key={validator.user_id}
                    className="flex flex-col gap-3 rounded-2xl border border-gray-800 bg-gray-950 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-bold text-white">
                        {validator.email ?? "Email inconnu"}
                      </p>

                      <p className="mt-1 text-xs text-gray-500">
                        Ajouté le{" "}
                        {new Date(validator.created_at).toLocaleDateString(
                          "fr-FR"
                        )}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeValidator(validator.user_id)}
                      className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-300 transition hover:bg-red-500/20"
                    >
                      Retirer
                    </button>
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