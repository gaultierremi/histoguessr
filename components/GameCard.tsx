"use client";

import { useState } from "react";
import type { Question } from "@/lib/types";

const POINTS_CORRECT = 100;

type AnswerRecord = {
  question: Question;
  playerAnswer: string;
  correct: boolean;
};

function isCorrectAnswer(player: string, correct: string): boolean {
  const norm = (s: string) => s.toLowerCase().trim();
  const p = norm(player);
  const c = norm(correct);
  if (!p) return false;
  if (c.includes(p) || p.includes(c)) return true;
  return c.split(/\s+/).filter((w) => w.length >= 3).some((kw) => p.includes(kw));
}

function DifficultyStars({ level }: { level: number | null }) {
  if (!level) return null;
  return (
    <span className="tracking-widest text-sm text-amber-500">
      {"★".repeat(level)}
      <span className="text-white/20">{"★".repeat(3 - level)}</span>
    </span>
  );
}

function ResultsScreen({
  answers,
  total,
  onReplay,
}: {
  answers: AnswerRecord[];
  total: number;
  onReplay: () => void;
}) {
  const correctCount = answers.filter((a) => a.correct).length;
  const score = correctCount * POINTS_CORRECT;
  const maxScore = total * POINTS_CORRECT;

  return (
    <div className="min-h-screen w-full bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl flex flex-col gap-6">
        <div className="text-center flex flex-col gap-2">
          <p className="text-gray-500 text-sm uppercase tracking-widest">Score final</p>
          <p className="text-5xl font-bold text-white">
            {score}
            <span className="text-gray-600 text-2xl"> / {maxScore}</span>
          </p>
          <p className="text-amber-500 text-lg">
            {correctCount} bonne{correctCount > 1 ? "s" : ""} réponse
            {correctCount > 1 ? "s" : ""} sur {total}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {answers.map((rec, i) => (
            <div
              key={i}
              className={`rounded-xl border p-4 flex flex-col gap-1 ${
                rec.correct
                  ? "bg-green-950/40 border-green-800"
                  : "bg-red-950/40 border-red-900"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs text-gray-500 uppercase tracking-widest">
                  Question {i + 1}
                </p>
                <span
                  className={`text-sm font-bold ${
                    rec.correct ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {rec.correct ? `+${POINTS_CORRECT}` : "+0"}
                </span>
              </div>
              <p className="text-gray-300 text-sm">
                <span className="text-gray-500">Réponse : </span>
                {rec.question.answer}
              </p>
              {!rec.correct && rec.playerAnswer && (
                <p className="text-gray-500 text-xs">
                  Votre réponse : {rec.playerAnswer}
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-center">
          <button
            onClick={onReplay}
            className="bg-amber-500 hover:bg-amber-400 text-gray-950 font-semibold px-8 py-3 rounded-lg transition-colors"
          >
            Rejouer
          </button>
        </div>
      </div>
    </div>
  );
}

export default function GameCard({ questions }: { questions: Question[] }) {
  const [step, setStep] = useState(0);
  const [input, setInput] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);

  const total = questions.length;
  const question = questions[step];
  const sessionDone = answers.length === total;

  function handleValidate() {
    if (!input.trim()) return;
    setIsCorrect(isCorrectAnswer(input, question.answer));
    setRevealed(true);
  }

  function handleNext() {
    setAnswers((prev) => [
      ...prev,
      { question, playerAnswer: input, correct: isCorrect },
    ]);
    if (step < total - 1) {
      setStep((s) => s + 1);
      setInput("");
      setRevealed(false);
      setIsCorrect(false);
    }
  }

  if (sessionDone) {
    return (
      <ResultsScreen
        answers={answers}
        total={total}
        onReplay={() => (window.location.href = "/game")}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-950 overflow-hidden">
      {/* Image plein écran */}
      <img
        src={`/api/image-proxy?url=${encodeURIComponent(question.image_url)}`}
        alt="Trouvez l'anachronisme"
        className="w-full h-full object-contain"
      />

      {/* Overlay top — Q1/5, période, étoiles, barre */}
      <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 via-black/40 to-transparent pb-8 pt-4 px-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-white font-semibold">
              Q{step + 1}
              <span className="text-white/40 font-normal"> / {total}</span>
            </span>
            {question.period && (
              <>
                <span className="text-white/30">·</span>
                <span className="text-white/70 text-sm">{question.period}</span>
              </>
            )}
          </div>
          <DifficultyStars level={question.difficulty} />
        </div>
        <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-500 rounded-full transition-all duration-500"
            style={{ width: `${(step / total) * 100}%` }}
          />
        </div>
      </div>

      {/* Overlay bottom — saisie ou révélation */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-16 pb-6 px-4">
        {!revealed ? (
          <div className="flex gap-3 max-w-2xl mx-auto">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleValidate()}
              placeholder="Quel est l'anachronisme ?"
              autoFocus
              className="flex-1 bg-black/60 backdrop-blur-sm text-white placeholder-white/40 border border-white/20 rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500 transition-colors text-base"
            />
            <button
              onClick={handleValidate}
              disabled={!input.trim()}
              className="shrink-0 bg-amber-500 hover:bg-amber-400 disabled:opacity-30 disabled:cursor-not-allowed text-gray-950 font-semibold px-6 py-3 rounded-xl transition-colors"
            >
              Valider
            </button>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto">
            <div
              className={`rounded-xl border p-4 backdrop-blur-sm ${
                isCorrect
                  ? "bg-green-950/90 border-green-700"
                  : "bg-red-950/90 border-red-800"
              }`}
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <p
                    className={`font-bold text-lg leading-tight ${
                      isCorrect ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {isCorrect ? "Correct !" : "Pas tout à fait…"}
                  </p>
                  <p
                    className={`text-sm ${
                      isCorrect ? "text-green-500" : "text-red-500"
                    }`}
                  >
                    {isCorrect ? `+${POINTS_CORRECT} pts` : "+0 pt"}
                  </p>
                </div>
                <button
                  onClick={handleNext}
                  className="shrink-0 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold px-5 py-2 rounded-lg transition-colors text-sm"
                >
                  {step < total - 1 ? "Suivante →" : "Résultats →"}
                </button>
              </div>

              <p className="text-white text-sm">
                <span className="text-white/50">Réponse : </span>
                <span className="font-medium">{question.answer}</span>
              </p>

              {question.hint && (
                <p className="text-white/60 text-sm mt-1">
                  <span className="text-white/40">Indice : </span>
                  {question.hint}
                </p>
              )}

              {question.source_url && (
                <a
                  href={question.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-xs text-white/30 hover:text-white/60 transition-colors mt-2"
                >
                  Source ↗
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
