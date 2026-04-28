import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-browser";
import type { TimelineEvent, DailyChallenge, DailyScore } from "@/lib/types";

// ─── Seeded PRNG (xorshift32) ─────────────────────────────────────────────────

function dateToSeed(dateStr: string): number {
  let hash = 0;
  for (const c of dateStr) {
    hash = ((hash << 5) - hash + c.charCodeAt(0)) | 0;
  }
  return (hash >>> 0) || 1;
}

function makeRng(seed: number): () => number {
  let s = seed;
  return () => {
    s ^= s << 13;
    s ^= s >> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Public types ─────────────────────────────────────────────────────────────

export type DailyChallengeWithEvents = {
  challenge: DailyChallenge;
  events: TimelineEvent[];
};

export type DailyLeaderboardEntry = {
  rank: number;
  user_name: string;
  score: number;
  max_score: number;
  submitted_at: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EVENT_SELECT =
  "id, title, description, year, image_url, category, difficulty, status, rejection_reason, created_at, fun_fact";

async function fetchEventsByIds(
  supabase: SupabaseClient,
  ids: string[]
): Promise<TimelineEvent[]> {
  const { data, error } = await supabase
    .from("timeline_events")
    .select(EVENT_SELECT)
    .in("id", ids);
  if (error || !data) throw new Error("Impossible de récupérer les événements du défi");
  const map = new Map((data as TimelineEvent[]).map((e) => [e.id, e]));
  return ids.map((id) => map.get(id)!).filter(Boolean);
}

// ─── Server-side functions ────────────────────────────────────────────────────

export async function getDailyChallenge(
  supabase: SupabaseClient
): Promise<DailyChallengeWithEvents> {
  const today = new Date().toISOString().slice(0, 10);

  const { data: existing } = await supabase
    .from("daily_challenges")
    .select("id, date, event_ids, created_at")
    .eq("date", today)
    .maybeSingle();

  if (existing) {
    const events = await fetchEventsByIds(supabase, existing.event_ids as string[]);
    return { challenge: existing as DailyChallenge, events };
  }

  // Build today's challenge with seeded random (same result for everyone)
  const rand = makeRng(dateToSeed(today));

  const { data: allEvents, error } = await supabase
    .from("timeline_events")
    .select(EVENT_SELECT)
    .eq("status", "approved");

  if (error || !allEvents) throw new Error("Impossible de récupérer les événements");

  const byDiff: Record<number, TimelineEvent[]> = { 1: [], 2: [], 3: [] };
  for (const e of allEvents as TimelineEvent[]) byDiff[e.difficulty].push(e);

  const d1 = seededShuffle(byDiff[1], rand);
  const d2 = seededShuffle(byDiff[2], rand);
  const d3 = seededShuffle(byDiff[3], rand);

  const selected: TimelineEvent[] = [
    ...d1.slice(0, 3),
    ...d2.slice(0, 4),
    ...d3.slice(0, 3),
  ];

  // Supplement if a difficulty bucket is too small
  if (selected.length < 10) {
    const extras = seededShuffle(
      [...d1.slice(3), ...d2.slice(4), ...d3.slice(3)],
      rand
    );
    selected.push(...extras.slice(0, 10 - selected.length));
  }

  if (selected.length < 10) throw new Error("Pas assez d'événements disponibles");

  const event_ids = selected.map((e) => e.id);

  const { data: inserted, error: insertErr } = await supabase
    .from("daily_challenges")
    .insert({ date: today, event_ids })
    .select("id, date, event_ids, created_at")
    .single();

  if (insertErr) {
    // Concurrent insert by another request — fetch the winner
    const { data: refetch } = await supabase
      .from("daily_challenges")
      .select("id, date, event_ids, created_at")
      .eq("date", today)
      .single();
    if (!refetch) throw new Error("Impossible de créer le défi du jour");
    const events = await fetchEventsByIds(supabase, refetch.event_ids as string[]);
    return { challenge: refetch as DailyChallenge, events };
  }

  return { challenge: inserted as DailyChallenge, events: selected };
}

export async function hasPlayedToday(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10);
  const { data: challenge } = await supabase
    .from("daily_challenges")
    .select("id")
    .eq("date", today)
    .maybeSingle();
  if (!challenge) return false;

  const { data } = await supabase
    .from("daily_scores")
    .select("id")
    .eq("user_id", userId)
    .eq("challenge_id", (challenge as { id: string }).id)
    .maybeSingle();
  return !!data;
}

export async function getUserDailyResult(
  supabase: SupabaseClient,
  userId: string,
  challengeId: string
): Promise<DailyScore | null> {
  const { data } = await supabase
    .from("daily_scores")
    .select("id, challenge_id, user_id, user_name, score, max_score, created_at")
    .eq("user_id", userId)
    .eq("challenge_id", challengeId)
    .maybeSingle();
  return data as DailyScore | null;
}

export async function getDailyLeaderboard(
  supabase: SupabaseClient,
  date: string
): Promise<DailyLeaderboardEntry[]> {
  const { data: challenge } = await supabase
    .from("daily_challenges")
    .select("id")
    .eq("date", date)
    .maybeSingle();
  if (!challenge) return [];

  const { data, error } = await supabase
    .from("daily_scores")
    .select("user_name, score, max_score, created_at")
    .eq("challenge_id", (challenge as { id: string }).id)
    .order("score", { ascending: false })
    .limit(20);

  if (error || !data) return [];

  return (
    data as { user_name: string; score: number; max_score: number; created_at: string }[]
  ).map((row, i) => ({
    rank: i + 1,
    user_name: row.user_name,
    score: row.score,
    max_score: row.max_score,
    submitted_at: row.created_at,
  }));
}

// ─── Client-side function ─────────────────────────────────────────────────────

export async function saveDailyScore(
  userId: string,
  userName: string,
  challengeId: string,
  score: number,
  maxScore: number
): Promise<void> {
  const supabase = createClient();

  // Idempotent: do nothing if user already has a score for this challenge
  const { data: existing } = await supabase
    .from("daily_scores")
    .select("id")
    .eq("user_id", userId)
    .eq("challenge_id", challengeId)
    .maybeSingle();
  if (existing) return;

  const { error } = await supabase.from("daily_scores").insert({
    user_id: userId,
    user_name: userName,
    challenge_id: challengeId,
    score,
    max_score: maxScore,
  });
  if (error) console.error("saveDailyScore:", error.message);
}
