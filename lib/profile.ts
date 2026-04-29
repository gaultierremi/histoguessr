import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-browser";
import { getQuizLeaderboard } from "@/lib/scores";

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserProfile = {
  id: string;              // PK in user_profiles
  user_name: string;
  avatar_color: string;
  active_skin: string;
  unlocked_skins: string[];
  streak: number;
  last_played_date: string | null;
  created_at: string;
};

export type UserStats = UserProfile & {
  total_games: number;
  best_score: number;
  global_rank: number | null;
  favorite_mode: string | null;
};

// ─── Server-side functions ────────────────────────────────────────────────────

export async function getOrCreateProfile(
  supabase: SupabaseClient,
  userId: string,
  userName: string
): Promise<UserProfile> {
  const { data: existing } = await supabase
    .from("user_profiles")
    .select()
    .eq("id", userId)
    .maybeSingle();

  if (existing) return existing as UserProfile;

  const { data: created, error } = await supabase
    .from("user_profiles")
    .insert({ id: userId, user_name: userName })
    .select()
    .single();

  if (error) {
    // Race condition — fetch the row that was concurrently inserted
    const { data: refetch } = await supabase
      .from("user_profiles")
      .select()
      .eq("id", userId)
      .single();
    if (!refetch) throw new Error("Impossible de créer le profil utilisateur");
    return refetch as UserProfile;
  }
  return created as UserProfile;
}

export async function updateStreak(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const { data: row } = await supabase
    .from("user_profiles")
    .select("streak, last_played_date")
    .eq("id", userId)
    .maybeSingle();
  if (!row) return;

  const today = new Date().toISOString().slice(0, 10);
  const { streak, last_played_date } = row as {
    streak: number;
    last_played_date: string | null;
  };

  if (last_played_date === today) return; // already counted today

  const prev = new Date();
  prev.setUTCDate(prev.getUTCDate() - 1);
  const yesterday = prev.toISOString().slice(0, 10);

  const newStreak = last_played_date === yesterday ? streak + 1 : 1;

  await supabase
    .from("user_profiles")
    .update({ streak: newStreak, last_played_date: today })
    .eq("id", userId);
}

export async function unlockSkin(
  supabase: SupabaseClient,
  userId: string,
  skinId: string
): Promise<void> {
  const { data: row } = await supabase
    .from("user_profiles")
    .select("unlocked_skins")
    .eq("id", userId)
    .maybeSingle();
  if (!row) return;

  const skins = (row as { unlocked_skins: string[] }).unlocked_skins;
  if (skins.includes(skinId)) return;

  await supabase
    .from("user_profiles")
    .update({ unlocked_skins: [...skins, skinId] })
    .eq("id", userId);
}

export async function getUserStats(
  supabase: SupabaseClient,
  userId: string
): Promise<UserStats | null> {
  const { data: profile } = await supabase
    .from("user_profiles")
    .select()
    .eq("id", userId)
    .maybeSingle();
  if (!profile) return null;

  // quiz_scores and daily_scores use user_id (different column name)
  const [
    { count: quizGames },
    { count: dailyGames },
    quizBestResult,
    leaderboard,
  ] = await Promise.all([
    supabase
      .from("quiz_scores")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("daily_scores")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("quiz_scores")
      .select("score")
      .eq("user_id", userId)
      .order("score", { ascending: false })
      .limit(1),
    getQuizLeaderboard(supabase),
  ]);

  const total_games = (quizGames ?? 0) + (dailyGames ?? 0);
  const best_score =
    (quizBestResult.data?.[0] as { score: number } | undefined)?.score ?? 0;
  const rankIndex = leaderboard.findIndex((e) => e.user_id === userId);
  const global_rank = rankIndex >= 0 ? rankIndex + 1 : null;
  const favorite_mode =
    (dailyGames ?? 0) >= (quizGames ?? 0)
      ? "Ligne du temps"
      : (quizGames ?? 0) > 0
      ? "Quiz"
      : null;

  return {
    ...(profile as UserProfile),
    total_games,
    best_score,
    global_rank,
    favorite_mode,
  };
}

// ─── Client-side function ─────────────────────────────────────────────────────

export async function updateStreakClient(userId: string): Promise<void> {
  const supabase = createClient();
  return updateStreak(supabase, userId);
}
