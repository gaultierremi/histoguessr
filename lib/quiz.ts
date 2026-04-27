import { supabase } from "@/lib/supabase";
import type { QuizQuestion, QuizDifficulty } from "@/lib/types";

export async function getQuizQuestions(
  difficulty: QuizDifficulty,
  count = 10
): Promise<QuizQuestion[]> {
  const { data, error } = await supabase
    .from("quiz_questions")
    .select("*")
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
  return shuffled.slice(0, count) as QuizQuestion[];
}
