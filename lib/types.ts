export type QuestionStatus = "pending" | "approved" | "rejected";

export type Question = {
  id: string;
  image_url: string;
  source_url: string | null;
  answer: string;
  hint: string | null;
  period: string | null;
  difficulty: number | null;
  created_at: string;
  status: QuestionStatus;
  rejection_reason: string | null;
};
