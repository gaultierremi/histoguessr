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

export type QuizQuestionType = "mcq" | "truefalse";
export type QuizDifficulty = 1 | 2 | 3;
export type QuizQuestionStatus = "pending" | "to_check" | "approved" | "rejected";

export type QuizQuestion = {
  id: string;
  type: QuizQuestionType;
  question: string;
  options: string[];
  answer_index: number;
  explanation: string | null;
  period: string | null;
  difficulty: QuizDifficulty;
  status: QuizQuestionStatus;
  rejection_reason: string | null;
  created_at: string;
};
