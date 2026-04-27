import { supabase } from "@/lib/supabase";
import type { Question } from "@/lib/types";

export async function getRandomQuestion(): Promise<Question> {
  const { data, error } = await supabase
    .from("questions")
    .select("*")
    .eq("status", "approved")
    .limit(100);

  if (error) throw new Error(error.message);
  if (!data || data.length === 0)
    throw new Error("Aucune question disponible");

  const random = Math.floor(Math.random() * data.length);
  return data[random] as Question;
}

export async function getSessionQuestions(count = 5): Promise<Question[]> {
  const { data, error } = await supabase
    .from("questions")
    .select("*")
    .eq("status", "approved")
    .limit(100);

  console.log("getSessionQuestions — questions fetched:", data?.length);
  if (error) {
    console.error("getSessionQuestions — Supabase error:", error.message);
    throw new Error(error.message);
  }
  if (!data || data.length < count)
    throw new Error(`Pas assez de questions disponibles (minimum ${count})`);

  // Fisher-Yates shuffle, on garde les `count` premiers
  const shuffled = [...data];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count) as Question[];
}