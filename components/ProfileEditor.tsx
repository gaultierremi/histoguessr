"use client";

import { useMemo, useState } from "react";
import Avatar, { getLevelInfo } from "@/components/Avatar";
import {
  getRarityLabel,
  getSkinById,
  isSkinUnlocked,
  SKINS,
} from "@/lib/skins";
import { updateProfileClient, type UserStats } from "@/lib/profile";

const AVATAR_COLORS = [
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#8b5cf6",
  "#3b82f6",
  "#06b6d4",
  "#10b981",
  "#84cc16",
  "#eab308",
  "#78716c",
];

function getHistoricalTitle(profile: UserStats): string {
  if (profile.streak >= 7) return "Gardien du temps";
  if (profile.total_games >= 100) return "Légende historique";
  if (profile.favorite_mode === "Ligne du temps") return "Chronomancien";
  if (profile.favorite_mode === "Quiz") return "Archiviste";
  if (profile.total_games >= 50) return "Maître historien";
  if (profile.total_games >= 10) return "Apprenti érudit";
  return "Explorateur du passé";
}

function formatUnlockCondition(condition: string): string {
  switch (condition) {
    case "default":
      return "Débloqué par défaut";
    case "10_games":
      return "Jouer 10 parties";
    case "25_games":
      return "Jouer 25 parties";
    case "50_games":
      return "Jouer 50 parties";
    case "75_games":
      return "Jouer 75 parties";
    case "100_games":
      return "Jouer 100 parties";
    case "streak_3":
      return "Atteindre 3 jours de streak";
    case "streak_7":
      return "Atteindre 7 jours de streak";
    case "perfect_score":
      return "Faire un score parfait";
    case "daily_master":
      return "Réussir plusieurs défis quotidiens";
    case "quiz_master":
      return "Maîtriser les quiz";
    case "premium":
      return "Skin premium";
    default:
      return condition.replaceAll("_", " ");
  }
}

export default function ProfileEditor({
  initialProfile,
}: {
  initialProfile: UserStats;
}) {
  const [profile, setProfile] = useState(initialProfile);
  const [userName, setUserName] = useState(initialProfile.user_name);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const level = getLevelInfo(profile.total_games);
  const activeSkin = getSkinById(profile.active_skin);
  const historicalTitle = getHistoricalTitle(profile);

  const unlockedCount = SKINS.filter((skin) =>
    isSkinUnlocked(skin.id, profile.unlocked_skins)
  ).length;

  const hasChanges = useMemo(() => {
    return userName.trim() !== profile.user_name;
  }, [userName, profile.user_name]);

  async function saveProfile(updates?: {
    user_name?: string;
    avatar_color?: string;
    active_skin?: string;
  }) {
    try {
      setSaving(true);
      setMessage(null);

      const nextProfile = await updateProfileClient(profile.id, {
        ...updates,
        ...(updates?.user_name === undefined && hasChanges
          ? { user_name: userName }
          : {}),
      });

      setProfile({
        ...profile,
        ...nextProfile,
      });

      setUserName(nextProfile.user_name);
      setMessage("Profil mis à jour ✅");
    } catch (error) {
      console.error(error);
      setMessage(
        error instanceof Error
          ? error.message
          : "Impossible de mettre à jour le profil."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <section className="relative overflow-hidden rounded-[2rem] border border-amber-200 bg-gradient-to-br from-amber-50 via-orange-50 to-slate-100 p-6 shadow-sm md:p-8">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-amber-300/30 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-orange-300/20 blur-3xl" />

        <div className="relative flex flex-col items-center gap-8 text-center md:flex-row md:text-left">
          <div className="relative flex justify-center">
            <div className="absolute inset-0 rounded-full bg-amber-300/30 blur-3xl" />
            <Avatar
              profile={profile}
              totalGames={profile.total_games}
              size="xl"
              animated
            />
          </div>

          <div className="flex-1">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-amber-700">
              Profil joueur
            </p>

            <h1 className="mt-2 text-4xl font-black text-slate-950 md:text-5xl">
              {profile.user_name}
            </h1>

            <p className="mt-2 text-lg font-bold text-slate-700">
              {historicalTitle}
            </p>

            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
              Skin actif :{" "}
              <span className="font-black text-slate-900">
                {activeSkin.name}
              </span>{" "}
              · Collection :{" "}
              <span className="font-black text-slate-900">
                {unlockedCount}/{SKINS.length}
              </span>{" "}
              skins débloqués
            </p>

            <div className="mt-5 flex flex-wrap justify-center gap-2 md:justify-start">
              <span className="rounded-full bg-white px-3 py-1 text-sm font-black text-slate-700 shadow-sm">
                {level.label}
              </span>
              <span className="rounded-full bg-white px-3 py-1 text-sm font-black text-slate-700 shadow-sm">
                🔥 Streak {profile.streak}j
              </span>
              <span className="rounded-full bg-white px-3 py-1 text-sm font-black text-slate-700 shadow-sm">
                🎮 {profile.total_games} parties
              </span>
              <span className="rounded-full bg-white px-3 py-1 text-sm font-black text-slate-700 shadow-sm">
                🏆 Meilleur score {profile.best_score}
              </span>
            </div>
          </div>
        </div>
      </section>

      {message && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700 shadow-sm">
          {message}
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.5fr]">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-black text-slate-900">Identité</h2>
          <p className="mt-1 text-sm text-slate-500">
            Choisis ton pseudo et ta couleur principale.
          </p>

          <label className="mt-6 block">
            <span className="text-sm font-bold text-slate-700">
              Nom affiché
            </span>
            <input
              value={userName}
              onChange={(event) => setUserName(event.target.value)}
              maxLength={32}
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 font-semibold outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
              placeholder="Ton pseudo"
            />
          </label>

          <button
            type="button"
            disabled={saving || !hasChanges}
            onClick={() => saveProfile({ user_name: userName })}
            className="mt-4 w-full rounded-2xl bg-slate-900 px-4 py-3 font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "Sauvegarde..." : "Enregistrer le nom"}
          </button>

          <div className="mt-8">
            <h3 className="text-sm font-bold text-slate-700">
              Couleur avatar
            </h3>

            <div className="mt-3 grid grid-cols-5 gap-3">
              {AVATAR_COLORS.map((color) => {
                const selected = profile.avatar_color === color;

                return (
                  <button
                    key={color}
                    type="button"
                    onClick={() => saveProfile({ avatar_color: color })}
                    disabled={saving}
                    className={`h-12 rounded-2xl border-4 shadow-sm transition ${
                      selected
                        ? "scale-105 border-slate-900"
                        : "border-white hover:scale-105"
                    }`}
                    style={{ backgroundColor: color }}
                    aria-label={`Choisir la couleur ${color}`}
                  />
                );
              })}
            </div>
          </div>

          <div className="mt-8 rounded-3xl bg-slate-50 p-4">
            <p className="text-sm font-black text-slate-800">
              Identité historique
            </p>
            <p className="mt-1 text-2xl font-black text-amber-600">
              {historicalTitle}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Ce titre évolue selon ton activité, ton streak et ton mode favori.
            </p>
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <h2 className="text-xl font-black text-slate-900">
                Skins historiques
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Débloque des apparences en jouant et en gardant ton streak.
              </p>
            </div>

            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-black text-slate-600">
              {unlockedCount}/{SKINS.length} débloqués
            </span>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {SKINS.map((skin) => {
              const unlocked = isSkinUnlocked(skin.id, profile.unlocked_skins);
              const selected = profile.active_skin === skin.id;

              return (
                <button
                  key={skin.id}
                  type="button"
                  disabled={!unlocked || saving}
                  onClick={() => saveProfile({ active_skin: skin.id })}
                  className={`relative overflow-hidden rounded-3xl border p-4 text-left transition ${
                    selected
                      ? "border-amber-400 bg-amber-50 ring-4 ring-amber-100"
                      : unlocked
                      ? "border-slate-200 bg-white hover:border-amber-300 hover:bg-amber-50"
                      : "border-slate-200 bg-slate-50 opacity-70"
                  }`}
                >
                  <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-amber-200/20 blur-2xl" />

                  <div className="relative flex items-start gap-3">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm">
                      {unlocked ? (
                        <Avatar
                          profile={{
                            ...profile,
                            active_skin: skin.id,
                          }}
                          totalGames={profile.total_games}
                          size="md"
                          showBadge={false}
                        />
                      ) : (
                        <span className="text-3xl">🔒</span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-black text-slate-900">
                          {skin.name}
                        </h3>

                        {selected && (
                          <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-black text-white">
                            Actif
                          </span>
                        )}
                      </div>

                      <p className="mt-1 text-sm text-slate-600">
                        {skin.description}
                      </p>

                      {!unlocked && (
                        <p className="mt-2 text-xs font-black text-amber-600">
                          🔒 {formatUnlockCondition(skin.unlockCondition)}
                        </p>
                      )}

                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">
                          {getRarityLabel(skin.rarity)}
                        </span>

                        {"period" in skin && skin.period && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">
                            {skin.period}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}