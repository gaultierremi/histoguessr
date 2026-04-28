import { supabase } from "@/lib/supabase";
import type { TimelineEvent } from "@/lib/types";

export function calculateScore(guessedYear: number, realYear: number): number {
  return Math.max(0, 1000 - Math.abs(guessedYear - realYear));
}

export async function getTimelineEvents(
  difficulty: number,
  count = 8
): Promise<TimelineEvent[]> {
  const { data, error } = await supabase
    .from("timeline_events")
    .select("id, title, description, year, image_url, category, difficulty, status, rejection_reason, created_at, fun_fact")
    .eq("status", "approved")
    .eq("difficulty", difficulty)
    .limit(100);

  console.log("timeline data:", JSON.stringify(data?.[0]));
  if (error) throw new Error(error.message);
  if (!data || data.length < count)
    throw new Error(`Pas assez d'événements disponibles (minimum ${count})`);

  const shuffled = [...data];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count) as TimelineEvent[];
}
