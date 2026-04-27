import type { SupabaseClient } from "@supabase/supabase-js";
import type { Duel, QuizDifficulty, QuizQuestion } from "@/lib/types";

function randomCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

async function pickQuestionIds(
  supabase: SupabaseClient,
  difficulty: QuizDifficulty,
  count = 5
): Promise<string[]> {
  const { data, error } = await supabase
    .from("quiz_questions")
    .select("id")
    .eq("status", "approved")
    .eq("difficulty", difficulty)
    .limit(100);

  if (error) throw new Error(error.message);
  if (!data || data.length < count)
    throw new Error(`Pas assez de questions disponibles (minimum ${count})`);

  const shuffled = [...data];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count).map((q) => q.id);
}

export async function createDuel(
  supabase: SupabaseClient,
  hostId: string,
  hostName: string,
  difficulty: QuizDifficulty
): Promise<Duel> {
  const questionIds = await pickQuestionIds(supabase, difficulty);

  let duel: Duel | null = null;
  for (let attempts = 0; attempts < 10; attempts++) {
    const code = randomCode();
    const { data, error } = await supabase
      .from("duels")
      .insert({
        code,
        difficulty,
        question_ids: questionIds,
        host_id: hostId,
        host_name: hostName,
        status: "waiting",
      })
      .select()
      .single();

    if (!error) {
      duel = data as Duel;
      break;
    }
    if (!error.message.includes("duplicate") && !error.message.includes("unique")) {
      throw new Error(error.message);
    }
  }

  if (!duel) throw new Error("Impossible de générer un code unique");
  return duel;
}

export async function joinDuel(
  supabase: SupabaseClient,
  code: string,
  guestId: string,
  guestName: string
): Promise<Duel> {
  const { data: existing, error: fetchError } = await supabase
    .from("duels")
    .select()
    .eq("code", code)
    .eq("status", "waiting")
    .single();

  if (fetchError || !existing) throw new Error("Salon introuvable ou déjà commencé");

  const { data, error } = await supabase
    .from("duels")
    .update({ guest_id: guestId, guest_name: guestName, status: "ready" })
    .eq("id", existing.id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Duel;
}

export async function submitDuelAnswers(
  supabase: SupabaseClient,
  duelId: string,
  role: "host" | "guest",
  score: number
): Promise<void> {
  const col = role === "host" ? "host_score" : "guest_score";
  const { error } = await supabase
    .from("duels")
    .update({ [col]: score })
    .eq("id", duelId);

  if (error) throw new Error(error.message);
}

export async function getDuelQuestions(
  supabase: SupabaseClient,
  questionIds: string[]
): Promise<QuizQuestion[]> {
  const { data, error } = await supabase
    .from("quiz_questions")
    .select("*")
    .in("id", questionIds);

  if (error) throw new Error(error.message);
  if (!data) return [];

  // Preserve the order in which question_ids were stored
  const map = new Map((data as QuizQuestion[]).map((q) => [q.id, q]));
  return questionIds.map((id) => map.get(id)!).filter(Boolean);
}
